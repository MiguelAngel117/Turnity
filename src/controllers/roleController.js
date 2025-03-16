const pool = require('../connect/connection');
const Role = require('../models/role');

class RoleController {
    // Obtener todos los roles
    async getAllRoles() {
        const [roles] = await pool.execute('SELECT * FROM Roles');
        
        return roles.map(role => new Role(
            role.role_name,
            role.description
        ));
    }

    // Obtener rol por nombre
    async getRoleByName(role_name) {
        const [roles] = await pool.execute('SELECT * FROM Roles WHERE role_name = ?', [role_name]);
        
        if (roles.length === 0) return null;
        
        const role = roles[0];
        return new Role(role.role_name, role.description);
    }

    // Crear un nuevo rol
    async createRole(roleData) {
        const role = new Role(
            roleData.role_name,
            roleData.description
        );

        const validationErrors = role.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        // Verificar si el rol ya existe
        const [existingRole] = await pool.execute(
            'SELECT role_name FROM Roles WHERE role_name = ?', 
            [role.role_name]
        );

        if (existingRole.length > 0) {
            throw new Error('El rol ya existe en el sistema');
        }

        // Insertar el rol
        await pool.execute(
            'INSERT INTO Roles (role_name, description) VALUES (?, ?)', 
            [role.role_name, role.description]
        );

        return role;
    }

    // Actualizar rol
    async updateRole(role_name, roleData) {
        // Verificar si el rol existe
        const existingRole = await this.getRoleByName(role_name);
        if (!existingRole) {
            throw new Error('Rol no encontrado');
        }

        // Actualizar la descripción
        await pool.execute(
            'UPDATE Roles SET description = ? WHERE role_name = ?',
            [roleData.description, role_name]
        );

        return this.getRoleByName(role_name);
    }

    // Eliminar rol
    async deleteRole(role_name) {
        // Verificar si hay usuarios con este rol
        const [usersWithRole] = await pool.execute(
            'SELECT COUNT(*) as count FROM User_Role WHERE role_name = ?',
            [role_name]
        );

        if (usersWithRole[0].count > 0) {
            throw new Error('No se puede eliminar el rol porque hay usuarios que lo tienen asignado');
        }

        // Eliminar el rol
        await pool.execute('DELETE FROM Roles WHERE role_name = ?', [role_name]);
        return true;
    }

    // Obtener usuarios con un rol específico
    async getUsersByRole(role_name) {
        const [users] = await pool.execute(`
            SELECT u.number_document, u.alias_user, u.first_names, u.last_names, u.email
            FROM User_Role ur
            JOIN Users u ON ur.number_document = u.number_document
            WHERE ur.role_name = ? AND u.status_user = true
        `, [role_name]);
        
        return users;
    }
}

module.exports = new RoleController();