const pool = require('../connect/connection');
const User = require('../models/users');
const { tokenSign } = require('../helpers/generateToken');
const {encrypt,compare } = require('../helpers/handleBcrypt');

class UserController {
    // Crear un nuevo usuario
    async createUser(userData) {
        console.log(userData.number_document);
        
        const user = new User(
            String(userData.number_document), // Convertir a string
            userData.alias_user || "", // Asegurar que no sea undefined
            userData.first_names || "",
            userData.last_names || "",
            userData.email || "",
            userData.password || "",
            userData.status_user ?? true, // Manejar valores nulos o indefinidos correctamente
            userData.role_name || ""
        );

        const validationErrors = user.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        let connection;
        try {
            connection = await pool.getConnection(); // Obtener conexión del pool

            // Verificar si el usuario ya existe
            const [existingUser] = await connection.execute(
                'SELECT number_document FROM Users WHERE number_document = ? OR email = ? OR alias_user = ?', 
                [user.number_document, user.email, user.alias_user]
            );

            if (existingUser.length > 0) {
                return { status: 209, message: 'El usuario ya existe en el sistema' };
            }

            const hashedPassword = await encrypt(user.password);

            // Insertar el usuario
            await connection.execute(
                `INSERT INTO Users (number_document, alias_user, first_names, last_names, 
                email, password, status_user) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [
                    user.number_document, 
                    user.alias_user, 
                    user.first_names, 
                    user.last_names, 
                    user.email, 
                    hashedPassword, 
                    user.status_user
                ]
            );

            // Asignar rol si se especifica
            if (userData.role_name) {
                await this.assignRoleToUser(user.number_document, userData.role_name, userData.stores, userData.departments);
            }

            user.password = null;
            return {status: 201, user: user};
        } catch (error) {
            console.error("Error al crear usuario:", error);
            throw error;
        } finally {
            if (connection) connection.release();
        }
    }

    
    async assignRoleToUser(number_document, role_name, stores = null, departments = null) {
        // Verificar si el usuario existe
        console.log(number_document, role_name, stores, departments);
        const user = await this.getUserByDocument(number_document);
        if (!user) {
            throw new Error('Usuario no encontrado');
        }
        console.log("entra inico")
        // Verificar si el usuario tiene algún rol asignado
        const [existingRoles] = await pool.execute(
            'SELECT role_name FROM User_Role WHERE number_document = ?',
            [number_document]
        );
    
        // Si tiene roles asignados, eliminarlos
        if (existingRoles.length > 0) {
            await pool.execute(
                'DELETE FROM User_Role WHERE number_document = ?',
                [number_document]
            );
        }
    
        // Asignar el nuevo rol
        await pool.execute(
            'INSERT INTO User_Role (number_document, role_name) VALUES (?, ?)',
            [number_document, role_name]
        );
    
        // Si el rol es Administrador, ejecutamos el procedimiento almacenado
        if (role_name === 'Administrador') {
            console.log("entra a asdads")
            await pool.execute(
                'CALL AssignUserPermissions(?, ?)',
                [number_document, role_name]
            );
        } else if (role_name === 'Gerente' && stores) {
            console.log("enttrea")
            const storeIds = stores.toString();
            await pool.execute(
                'CALL AssignUserPermissionsSpecificStores(?, ?, ?)',
                [number_document, role_name, storeIds]
            );
        }else{
            const store = stores.toString();
            const deps = departments.toString();
            await pool.execute('CALL AssignUserPermissionsSpecificDepartments(?, ?, ?, ?)',
                [number_document, role_name, store, deps]);
        }
        console.log("pasa")
        return true;
    }
    
    async getAllUsers() {
        // Consulta principal que obtiene los usuarios con sus roles
        const [users] = await pool.execute(`
            SELECT u.number_document, u.alias_user, u.first_names, u.last_names, 
                   u.email, u.status_user, u.created_at, u.updated_at,
                   ur.role_name
            FROM Users u
            LEFT JOIN User_Role ur ON u.number_document = ur.number_document
        `);
        
        // Array para almacenar los resultados finales
        const formattedUsers = [];
        
        // Procesamos cada usuario
        for (const user of users) {
            let stores = [];
            let departments = [];
            
            // Dependiendo del rol, obtenemos las tiendas y departamentos
            if (user.role_name === 'Gerente') {
                // Para Gerentes: obtener todas las tiendas asignadas
                const [storeAccess] = await pool.execute(`
                    SELECT id_store 
                    FROM User_Store_Access 
                    WHERE number_document = ?
                `, [user.number_document]);
                
                stores = storeAccess.map(store => store.id_store);
            } 
            else if (user.role_name === 'Jefe') {
                // Para Jefes: obtener la única tienda asignada y sus departamentos
                const [storeAccess] = await pool.execute(`
                    SELECT id_store 
                    FROM User_Store_Access 
                    WHERE number_document = ?
                `, [user.number_document]);
                
                stores = storeAccess.map(store => store.id_store);
                
                // Obtener departamentos asignados para esa tienda
                const [deptAccess] = await pool.execute(`
                    SELECT id_department 
                    FROM User_Department_Access 
                    WHERE number_document = ? AND id_store = ?
                `, [user.number_document, stores[0]]);
                
                departments = deptAccess.map(dept => dept.id_department);
            }
            
            // Crear el objeto de usuario con la información requerida
            const userObj = {
                number_document: user.number_document,
                alias_user: user.alias_user,
                first_names: user.first_names,
                last_names: user.last_names,
                email: user.email,
                status_user: user.status_user,
                role_name: user.role_name
            };
            
            // Agregar tiendas y departamentos solo si corresponde al rol
            if (userObj.role_name === 'Gerente' || userObj.role_name === 'Jefe') {
                userObj.stores = stores;
                // Solo agregar departamentos para Jefes
                if (userObj.role_name === 'Jefe') {
                    userObj.departments = departments;
                }
            }
            
            formattedUsers.push(userObj);
        }
        
        return formattedUsers;
    }
    
    // Obtener usuario por número de documento
    async getUserByDocument(number_document) {
        const [users] = await pool.execute(`
            SELECT u.number_document, u.alias_user, u.first_names, u.last_names, 
            u.email, u.status_user, u.created_at, u.updated_at,
            ur.role_name
            FROM Users u
            LEFT JOIN User_Role ur ON u.number_document = ur.number_document
            WHERE u.number_document = ?
        `, [number_document]);
        
        if (users.length === 0) return null;
        
        const user = users[0];
        return new User(
            user.number_document,
            user.alias_user,
            user.first_names,
            user.last_names,
            user.email,
            null, // No devolvemos la contraseña
            user.status_user,
            user.role_name // Añadimos el rol del usuario
        );
    }

    async updateUser(number_document, userData) {
        // Verificar si el usuario existe
        const existingUser = await this.getUserByDocument(number_document);
        
        if (!existingUser) {
            return 'Usuario no encontrado';
        }
        // Preparar los datos a actualizar
        const fieldsToUpdate = [];
        const values = [];

        if (userData.alias_user) {
            fieldsToUpdate.push('alias_user = ?');
            values.push(userData.alias_user);
        }
        

        if (userData.first_names) {
            fieldsToUpdate.push('first_names = ?');
            values.push(userData.first_names);
        }

        if (userData.last_names) {
            fieldsToUpdate.push('last_names = ?');
            values.push(userData.last_names);
        }

        if (userData.email) {
            fieldsToUpdate.push('email = ?');
            values.push(userData.email);
        }
        
        if (userData.status_user !== undefined && userData.status_user !== null) {
            fieldsToUpdate.push('status_user = ?');
            values.push(userData.status_user);
        }

        if(userData.role_name){
            await this.assignRoleToUser(number_document, userData.role_name, userData.stores, userData.departments);
        }
        if (fieldsToUpdate.length === 0) {
            return {status:209, message: 'No hay campos para actualizar' };
        }

        // Añadir el número de documento al final para la cláusula WHERE
        values.push(number_document);
        // Ejecutar la actualización
        await pool.execute(
            `UPDATE Users SET ${fieldsToUpdate.join(', ')} WHERE number_document = ?`,
            values
        );

        return {status: 200, data: this.getUserByDocument(number_document)};
    }

   // Eliminar usuario (desactivar)
    async deleteUser(number_document) {
        try {
            // Eliminar referencias en User_Department_Access
            await pool.execute(
                'DELETE FROM User_Department_Access WHERE number_document = ?',
                [number_document]
            );

            // Eliminar referencias en User_Store_Access
            await pool.execute(
                'DELETE FROM User_Store_Access WHERE number_document = ?',
                [number_document]
            );

            // Eliminar referencias en User_Role
            await pool.execute(
                'DELETE FROM User_Role WHERE number_document = ?',
                [number_document]
            );

            // Finalmente, eliminar el usuario de Users
            await pool.execute(
                'DELETE FROM Users WHERE number_document = ?',
                [number_document]
            );

            return true;
        } catch (error) {
            console.error('Error al eliminar el usuario:', error.message);
            throw new Error('No se pudo eliminar el usuario. Por favor, intente nuevamente.');
        }
    }


    // Login de usuario
    async loginUser(identifier, password) {
        let query;
        let params;
    
        // Verifica si el identificador es un correo electrónico
        const isEmail = identifier.includes('@');
    
        // Definir la consulta y parámetros según si es email o alias_user
        
        if (isEmail) {
            query = 'SELECT * FROM Users WHERE email = ? AND status_user = true';
            params = [identifier];
        } else {
            query = 'SELECT * FROM Users WHERE alias_user = ? AND status_user = true';
            params = [identifier];
        }
 
        // Ejecutamos la consulta con el parámetro adecuado
        const [users] = await pool.execute(query, params);
        console.log(isEmail);
        if (users.length === 0) {
            const param = isEmail ? 'Correo electrónico' : 'Nombre de usuario';
            throw new Error(`${param} Incorrecto`);
        }

        const user = users[0];

        // Verificar la contraseña
        const validPassword = await compare(password, user.password);
        if (!validPassword) {
            throw new Error('Contraseña Incorrecta');
        }

        // Obtener los roles del usuario
        const [roles] = await pool.execute(
            'SELECT role_name FROM User_Role WHERE number_document = ?',
            [user.number_document]
        );

        const userRoles = roles.map(role => role.role_name);

        // Obtener los accesos a tiendas
        const [stores] = await pool.execute(
            'SELECT id_store FROM User_Store_Access WHERE number_document = ?',
            [user.number_document]
        );

        const userStores = stores.map(store => store.id_store);

        // Crear un token JWT
        const token = await tokenSign({
            number_document: user.number_document,
            roles: userRoles
        });

        return {
            token,
            user: {
                number_document: user.number_document,
                alias_user: user.alias_user,
                first_names: user.first_names,
                last_names: user.last_names,
                email: user.email,
                roles: userRoles,
                stores: userStores
            }
        };
    }

    // Obtener roles de un usuario
    async getUserRoles(number_document) {
        const [roles] = await pool.execute(`
            SELECT r.role_name, r.description
            FROM User_Role ur
            JOIN Roles r ON ur.role_name = r.role_name
            WHERE ur.number_document = ?
        `, [number_document]);
        
        return roles;
    }

    // Obtener tiendas accesibles para un usuario
    async getUserStores(number_document) {
        const [stores] = await pool.execute(`
            SELECT s.id_store, s.name_store
            FROM User_Store_Access usa
            JOIN Stores s ON usa.id_store = s.id_store
            WHERE usa.number_document = ?
        `, [number_document]);
        
        return stores.map(store => {
            const cleanName = store.name_store?.startsWith('FALABELLA - ') 
            ? store.name_store.substring(12)
            : store.name_store;
            
            return {
                id_store: store.id_store,
                name_store: cleanName
            };
        });
    }

    // Obtener departamentos accesibles para un usuario en una tienda
    async getUserDepartments(number_document, id_store) {
        const [departments] = await pool.execute(`
            SELECT d.id_department, d.name_department
            FROM User_Department_Access uda
            JOIN Departments d ON uda.id_department = d.id_department
            WHERE uda.number_document = ? AND uda.id_store = ?
        `, [number_document, id_store]);
        
        return departments;
    }

    // Quitar un rol a un usuario
    async removeRoleFromUser(number_document, role_name) {
        await pool.execute(
            'DELETE FROM User_Role WHERE number_document = ? AND role_name = ?',
            [number_document, role_name]
        );
        return true;
    }

    // Quitar acceso a una tienda
    async removeStoreAccess(number_document, id_store) {
        await pool.execute(
            'DELETE FROM User_Store_Access WHERE number_document = ? AND id_store = ?',
            [number_document, id_store]
        );

        // También eliminamos los accesos a departamentos de esta tienda
        await pool.execute(
            'DELETE FROM User_Department_Access WHERE number_document = ? AND id_store = ?',
            [number_document, id_store]
        );

        return true;
    }

    // Quitar acceso a uno o varios departamentos
    async removeDepartmentAccess(number_document, id_store, id_departments) {
        // Convertir a array si es un solo departamento
        const departmentIds = Array.isArray(id_departments) ? id_departments : [id_departments];
        
        // Resultados de la operación
        const results = [];

        // Quitar acceso a cada departamento
        for (const id_department of departmentIds) {
            try {
                // Verificar si existe el acceso
                const [existingAccess] = await pool.execute(
                    'SELECT id_user_department FROM User_Department_Access WHERE number_document = ? AND id_store = ? AND id_department = ?',
                    [number_document, id_store, id_department]
                );

                if (existingAccess.length === 0) {
                    results.push({
                        id_department,
                        success: false,
                        message: 'El usuario no tiene acceso a este departamento'
                    });
                    continue;
                }

                // Quitar acceso
                await pool.execute(
                    'DELETE FROM User_Department_Access WHERE number_document = ? AND id_store = ? AND id_department = ?',
                    [number_document, id_store, id_department]
                );

                results.push({
                    id_department,
                    success: true,
                    message: 'Acceso removido correctamente'
                });
            } catch (error) {
                results.push({
                    id_department,
                    success: false,
                    message: error.message
                });
            }
        }

        return {
            allSuccessful: results.every(result => result.success),
            results
        };
    }

    async getDepartmentAccess(number_document) {
        try {
            // Obtener las tiendas a las que el usuario tiene acceso
            const [stores] = await pool.execute(
                'SELECT DISTINCT id_store FROM User_Department_Access WHERE number_document = ?',
                [number_document]
            );

            // Si el usuario no tiene acceso a ninguna tienda
            if (stores.length === 0) {
                return {
                    success: false,
                    message: 'El usuario no tiene acceso a ninguna tienda',
                    data: []
                };
            }

            // Obtener los departamentos asociados a cada tienda
            const storeData = [];
            for (const store of stores) {
                const [departments] = await pool.execute(
                    'SELECT id_department FROM User_Department_Access WHERE number_document = ? AND id_store = ?',
                    [number_document, store.id_store]
                );

                storeData.push({
                    id_store: store.id_store,
                    departments: departments.map(dept => dept.id_department)
                });
            }

            return {
                success: true,
                message: 'Accesos obtenidos correctamente',
                data: storeData
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                data: []
            };
        }
    }
}

module.exports = new UserController();