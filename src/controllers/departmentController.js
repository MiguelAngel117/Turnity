const pool = require('../connect/connection');
const Department = require('../models/department');

class DepartmentController {
    // Obtener todos los departamentos
    async getAllDepartments() {
        const [departments] = await pool.execute('SELECT * FROM Departments');
        return departments.map(dept => 
            new Department(dept.id_department, dept.name_department, dept.cod_ce_cost)
        );
    }

    // Obtener departamento por ID
    async getDepartmentById(id_department) {
        const [departments] = await pool.execute(
            'SELECT * FROM Departments WHERE id_department = ?', 
            [id_department]
        );
        
        if (departments.length === 0) return null;
        
        const dept = departments[0];
        return new Department(dept.id_department, dept.name_department, dept.cod_ce_cost);
    }

    // Crear nuevo departamento
    async createDepartment(departmentData) {
        const department = new Department(
            departmentData.id_department, 
            departmentData.name_department, 
            departmentData.cod_ce_cost
        );

        const validationErrors = department.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        const [result] = await pool.execute(
            'INSERT INTO Departments (name_department, cod_ce_cost) VALUES (?, ?)', 
            [department.name_department, department.cod_ce_cost]
        );

        department.id_department = result.insertId;
        return department;
    }

    // Actualizar departamento
    async updateDepartment(id_department, departmentData) {
        await pool.execute(
            'UPDATE Departments SET name_department = ?, cod_ce_cost = ? WHERE id_department = ?', 
            [departmentData.name_department, departmentData.cod_ce_cost, id_department]
        );

        return this.getDepartmentById(id_department);
    }

    // Eliminar departamento
    async deleteDepartment(id_department) {
        await pool.execute('DELETE FROM Departments WHERE id_department = ?', [id_department]);
        return true;
    }
}

module.exports = new DepartmentController();