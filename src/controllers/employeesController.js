const pool = require('../connect/connection');
const Employee = require('../models/employees');

class EmployeeController {
    async createEmployeesFromExcel(employeesData) {
        const results = {
            successful: [],
            failed: [],
            total: employeesData.length,
            warnings: []
        };

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [existingDocs] = await connection.query('SELECT number_document FROM Employees');
            const existingDocuments = existingDocs.map(doc => doc.number_document);

            const [deptStores] = await connection.query(`
                SELECT ds.id_store_dep, s.id_store, d.id_department 
                FROM Department_Store ds
                JOIN Stores s ON s.id_store = ds.id_store
                JOIN Departments d ON d.id_department = ds.id_department
            `);
            
            const [positions] = await connection.query('SELECT id_position, name_position FROM Positions');

            for (const data of employeesData) {
                try {
                    if (!data.Cod_Sucursal || !data.Num_Documento || !data.NombreEmpleado || 
                        !data.Cod_Cargo || !data.Cod_Depto || !data.jornada) {
                        throw new Error('Faltan campos requeridos');
                    }

                    const numberDocument = parseInt(data.Num_Documento);
                    if (isNaN(numberDocument)) {
                        throw new Error('Número de documento inválido');
                    }

                    if (existingDocuments.includes(numberDocument)) {
                        throw new Error('El empleado ya existe');
                    }

                    const storeDepRelation = deptStores.find(
                        ds => ds.id_store === parseInt(data.Cod_Sucursal) && 
                             ds.id_department === parseInt(data.Cod_Depto)
                    );

                    if (!storeDepRelation) {
                        throw new Error(`Relación no existe: Sucursal ${data.Cod_Sucursal} - Departamento ${data.Cod_Depto}`);
                    }

                    const position = positions.find(p => p.id_position === parseInt(data.Cod_Cargo));
                    if (!position) {
                        throw new Error(`Cargo no válido: ${data.Cod_Cargo} - ${data.Cargo}`);
                    }

                    let numDocManager = null;
                    let managerWarning = null;
                    if (data.Docto_Superior) {
                        const managerDoc = parseInt(data.Docto_Superior);
                        if (!existingDocuments.includes(managerDoc)) {
                            managerWarning = `Superior no encontrado: ${data.Docto_Superior} - ${data.Nombre_Superior}. Se asignó como null`;
                        } else {
                            numDocManager = managerDoc;
                        }
                    }

                    const employee = new Employee(
                        numberDocument,
                        numDocManager,
                        data.NombreEmpleado.trim(),
                        parseInt(data.jornada)
                    );

                    await connection.query(
                        `INSERT INTO Employees 
                        (number_document, num_doc_manager, full_name, working_day) 
                        VALUES (?, ?, ?, ?)`,
                        [
                            employee.number_document,
                            employee.num_doc_manager,
                            employee.full_name,
                            employee.working_day
                        ]
                    );

                    await connection.query(
                        `INSERT INTO Employees_Department 
                        (number_document, id_store_dep, id_position) 
                        VALUES (?, ?, ?)`,
                        [
                            employee.number_document,
                            storeDepRelation.id_store_dep,
                            position.id_position
                        ]
                    );

                    existingDocuments.push(employee.number_document);
                    results.successful.push({
                        document: employee.number_document,
                        name: employee.full_name,
                        store: data.Sucursal,
                        department: data.Departamento,
                        position: data.Cargo
                    });

                    if (managerWarning) {
                        results.warnings.push({
                            document: employee.number_document,
                            warning: managerWarning
                        });
                    }

                } catch (error) {
                    results.failed.push({
                        data: {
                            document: data.Num_Documento,
                            name: data.NombreEmpleado,
                            store: data.Sucursal,
                            department: data.Departamento
                        },
                        error: error.message
                    });
                }
            }

            await connection.commit();

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        return {
            ...results,
            stats: {
                total: results.total,
                successful: results.successful.length,
                failed: results.failed.length,
                warnings: results.warnings.length
            }
        };
    }
    
    // Obtener todos los empleados
    async getAllEmployees() {
        const [employees] = await pool.execute(`
            SELECT 
                e1.number_document AS employee_document, 
                e1.full_name AS employee_name,  
                e1.working_day AS working_day,
                e1.num_doc_manager AS manager_document,  
                e2.full_name AS manager_name
            FROM 
                Employees e1
            LEFT JOIN  
                Employees e2 
            ON 
                e1.num_doc_manager = e2.number_document;
        `);

        // Retornar objetos con la información necesaria
        return employees.map(emp => ({
            employee_document: emp.employee_document,
            employee_name: emp.employee_name,
            working_day: emp.working_day,
            manager_document: emp.manager_document,
            manager_name: emp.manager_name || null, // Nombre del jefe (null si no tiene)
        }));
    }


// Obtener empleado por número de documento
async getEmployeeByDocument(number_document) {
    const [employees] = await pool.execute(`
        SELECT 
            e1.number_document AS employee_document, 
            e1.full_name AS employee_name,  
            e1.working_day AS working_day,
            e1.num_doc_manager AS manager_document,  
            e2.full_name AS manager_name
        FROM 
            Employees e1
        LEFT JOIN  
            Employees e2 
        ON 
            e1.num_doc_manager = e2.number_document
        WHERE 
            e1.number_document = ?`, 
        [number_document]
    );

    if (employees.length === 0) return null;

    const emp = employees[0];
    return {
        employee_document: emp.employee_document,
        employee_name: emp.employee_name,
        working_day: emp.working_day,
        manager_document: emp.manager_document,
        manager_name: emp.manager_name || null, // Nombre del jefe (null si no tiene)
    };
}

    // Crear nuevo empleado
    async createEmployee(employeeData) {
        const employee = new Employee(
            employeeData.number_document,
            employeeData.num_doc_manager,
            employeeData.full_name,
            employeeData.working_day
        );

        const validationErrors = employee.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        await pool.execute(
            `INSERT INTO Employees 
            (number_document, num_doc_manager, full_name, working_day) 
            VALUES (?, ?, ?, ?, ?)`, 
            [
                employee.number_document, 
                employee.num_doc_manager, 
                employee.full_name,  
                employee.working_day
            ]
        );

        return employee;
    }

    // Actualizar empleado
    async updateEmployee(number_document, employeeData) {
        await pool.execute(
            `UPDATE Employees 
            SET 
                num_doc_manager = ?, 
                full_name = ?, 
                working_day = ? 
            WHERE number_document = ?`, 
            [
                employeeData.num_doc_manager, 
                employeeData.full_name, 
                employeeData.working_day,
                number_document
            ]
        );

        return this.getEmployeeByDocument(number_document);
    }

    // Eliminar empleado
    async deleteEmployee(number_document) {
        await pool.execute(
            `DELETE FROM Employees WHERE number_document = ?`, 
            [number_document]
        );
        return true;
    }

    // Obtener empleados de un gerente específico
    async getEmployeesByManager(num_doc_manager) {
        const [employees] = await pool.execute(
            `SELECT * FROM Employees WHERE num_doc_manager = ?`, 
            [num_doc_manager]
        );
        
        return employees.map(emp => new Employee(
            emp.number_document, 
            emp.num_doc_manager, 
            emp.full_name, 
            emp.working_day
        ));
    }
}

module.exports = new EmployeeController();