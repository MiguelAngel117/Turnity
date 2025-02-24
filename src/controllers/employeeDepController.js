const pool = require('../connect/connection');
const EmployeeDepartment = require('../models/employeeDepartment');

class EmployeeDepartmentController {
    async getAll() {
        const [rows] = await pool.query(`
            SELECT ed.*, e.full_name, e.working_day, p.name_position, 
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
            SELECT ed.*, e.full_name, e.working_day, p.name_position, 
                   d.name_department, s.name_store
            FROM Employees_Department ed
            JOIN Employees e ON e.number_document = ed.number_document
            JOIN Positions p ON p.id_position = ed.id_position
            JOIN Department_Store ds ON ds.id_store_dep = ed.id_store_dep
            JOIN Departments d ON d.id_department = ds.id_department
            JOIN Stores s ON s.id_store = ds.id_store
            WHERE s.id_store = ? AND d.id_department = ?
        `, [storeId, departmentId]);
        return rows;
    }

    // Obtener personas por sucursal, departamento y cargo
    async getByStoreDepartmentAndPosition(storeId, departmentId, positionId) {
        const [rows] = await pool.query(`
            SELECT ed.*, e.full_
            name, e.working_day, p.name_position, 
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