const pool = require('../connect/connection');
const moment = require('moment');

const EmployeeDepartment = require('../models/employeeDepartment');

class EmployeeDepartmentController {

    async addEmployeesToDepartment(employees) {
        try {
            let contractDate = this.getNextMonday();
            let insertedEmployees = [];
    
            for (const emp of employees) {
                // Obtener el último registro del empleado
                const [[lastRecord]] = await pool.query(`
                    SELECT working_day, id_store_dep, id_position 
                    FROM Employees_Department 
                    WHERE number_document = ? 
                    ORDER BY contract_date DESC, id_employee_dep DESC 
                    LIMIT 1
                `, [emp.number_document]);
    
                // Si hay un registro y es idéntico al nuevo, omitir la inserción
                if (lastRecord &&
                    lastRecord.working_day === emp.working_day &&
                    lastRecord.id_store_dep === emp.id_store_dep &&
                    lastRecord.id_position === emp.id_position) {
                    console.log(`Empleado ${emp.number_document} ya tiene un registro idéntico, omitiendo inserción.`);
                    continue;
                }
    
                // Insertar el nuevo registro
                const [result] = await pool.query(`
                    INSERT INTO Employees_Department 
                    (number_document, contract_date, working_day, id_store_dep, id_position) 
                    VALUES (?, ?, ?, ?, ?)
                `, [emp.number_document, contractDate, emp.working_day, emp.id_store_dep, emp.id_position]);
    
                insertedEmployees.push({ number_document: emp.number_document, id: result.insertId });
            }
    
            return {
                success: true,
                message: `Se insertaron ${insertedEmployees.length} empleados.`,
                insertedEmployees
            };
        } catch (error) {
            console.error("Error al insertar empleados:", error);
            return { success: false, message: "Error al insertar empleados", error };
        }
    }
    
    // Función para obtener el próximo lunes
    getNextMonday() {
        let today = moment();
        let nextMonday = today.isoWeekday() === 1 ? today : today.isoWeekday(8);
        return nextMonday.format("YYYY-MM-DD");
    }

    async getAll() {
        const [rows] = await pool.query(`
            SELECT ed.*, e.full_name, p.name_position, 
                   d.name_department, s.name_store
            FROM Employees_Department ed
            JOIN Employees e ON e.number_document = ed.number_document
            JOIN Positions p ON p.id_position = ed.id_position
            JOIN Department_Store ds ON ds.id_store_dep = ed.id_store_dep
            JOIN Departments d ON d.id_department = ds.id_department
            JOIN Stores s ON s.id_store = ds.id_store
        `);
        return rows;
    }

    async getByDocument(number_document) {
        const [rows] = await pool.query(`
            SELECT ed.*, e.full_name, p.name_position, 
                   d.name_department, s.name_store
            FROM Employees_Department ed
            JOIN Employees e ON e.number_document = ed.number_document
            JOIN Positions p ON p.id_position = ed.id_position
            JOIN Department_Store ds ON ds.id_store_dep = ed.id_store_dep
            JOIN Departments d ON d.id_department = ds.id_department
            JOIN Stores s ON s.id_store = ds.id_store
            WHERE ed.number_document = ?
        `, [number_document]);
        
        if (rows[0]) {
            return new EmployeeDepartment(
                rows[0].number_document,
                rows[0].id_store_dep,
                rows[0].id_position
            );
        }
        return null;
    }

    // Obtener personas por sucursal
    async getByStore(storeId) {
        const [rows] = await pool.query(`
            SELECT ed.*, e.full_name, p.name_position, 
                   d.name_department, s.name_store
            FROM Employees_Department ed
            JOIN Employees e ON e.number_document = ed.number_document
            JOIN Positions p ON p.id_position = ed.id_position
            JOIN Department_Store ds ON ds.id_store_dep = ed.id_store_dep
            JOIN Departments d ON d.id_department = ds.id_department
            JOIN Stores s ON s.id_store = ds.id_store
            WHERE s.id_store = ?
        `, [storeId]);
        return rows;
    }

    // Obtener personas por sucursal y departamento
    async getByStoreAndDepartment(storeId, departmentId) {
        const [rows] = await pool.query(`
            SELECT ed.*, e.full_name, p.name_position, 
                   d.name_department, s.name_store
            FROM Employees_Department ed
            JOIN Employees e ON e.number_document = ed.number_document
            JOIN Positions p ON p.id_position = ed.id_position
            JOIN Department_Store ds ON ds.id_store_dep = ed.id_store_dep
            JOIN Departments d ON d.id_department = ds.id_department
            JOIN Stores s ON s.id_store = ds.id_store
            JOIN (
                SELECT number_document, MAX(id_employee_dep) AS max_id
                FROM Employees_Department
                WHERE (number_document, contract_date) IN (
                    SELECT number_document, MAX(contract_date)
                    FROM Employees_Department
                    GROUP BY number_document
                )
                GROUP BY number_document
            ) latest ON ed.id_employee_dep = latest.max_id
            WHERE s.id_store = ? AND d.id_department = ?;
        `, [storeId, departmentId]);
    
        return rows;
    }
    
    

    // Obtener personas por sucursal, departamento y cargo
    async getByStoreDepartmentAndPosition(storeId, departmentId, positionId) {
        const [rows] = await pool.query(`
            SELECT ed.*, e.full_
            name, p.name_position, 
                   d.name_department, s.name_store
            FROM Employees_Department ed
            JOIN Employees e ON e.number_document = ed.number_document
            JOIN Positions p ON p.id_position = ed.id_position
            JOIN Department_Store ds ON ds.id_store_dep = ed.id_store_dep
            JOIN Departments d ON d.id_department = ds.id_department
            JOIN Stores s ON s.id_store = ds.id_store
            WHERE s.id_store = ? AND d.id_department = ? AND p.id_position = ?
        `, [storeId, departmentId, positionId]);
        return rows;
    }

    async update(employeeDepartmentData) {
        const empDept = new EmployeeDepartment(
            employeeDepartmentData.number_document,
            employeeDepartmentData.id_store_dep,
            employeeDepartmentData.id_position
        );

        const validation = empDept.validate();
        if (validation) throw new Error(validation.join(', '));

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.query(`
                UPDATE Employees_Department 
                SET id_store_dep = ?, id_position = ?
                WHERE number_document = ?
            `, [empDept.id_store_dep, empDept.id_position, empDept.number_document]);

            await connection.commit();
            return await this.getByDocument(empDept.number_document);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async delete(number_document) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query(
                'DELETE FROM Employees_Department WHERE number_document = ?', 
                [number_document]
            );
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = EmployeeDepartmentController;