const pool = require('../connect/connection');
const DepartmentStore = require('../models/departmentStore');

class DepartmentStoreController {
    // Obtener todos los departamentos de tiendas
    async getAllDepartmentStores() {
        const [departmentStores] = await pool.execute(`
            SELECT ds.*, 
                   s.name_store, 
                   d.name_department 
            FROM Department_Store ds
            JOIN Stores s ON ds.id_store = s.id_store
            JOIN Departments d ON ds.id_department = d.id_department
        `);
        
        return departmentStores.map(ds => 
            new DepartmentStore(ds.id_store_dep, ds.id_store, ds.id_department)
        );
    }

    // Obtener departamentos de tienda por ID
    async getDepartmentStoreById(id_store_dep) {
        const [departmentStores] = await pool.execute(
            `SELECT ds.*, 
                    s.name_store, 
                    d.name_department 
             FROM Department_Store ds
             JOIN Stores s ON ds.id_store = s.id_store
             JOIN Departments d ON ds.id_department = d.id_department
             WHERE ds.id_store_dep = ?`, 
            [id_store_dep]
        );
        
        if (departmentStores.length === 0) return null;
        
        const ds = departmentStores[0];
        return new DepartmentStore(ds.id_store_dep, ds.id_store, ds.id_department);
    }

    // Crear departamento de tienda
    async createDepartmentStore(departmentStoreData) {
        const departmentStore = new DepartmentStore(
            departmentStoreData.id_store_dep,
            departmentStoreData.id_store, 
            departmentStoreData.id_department
        );

        const validationErrors = departmentStore.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        const [result] = await pool.execute(
            'INSERT INTO Department_Store (id_store, id_department) VALUES (?, ?)', 
            [departmentStore.id_store, departmentStore.id_department]
        );

        departmentStore.id_store_dep = result.insertId;
        return departmentStore;
    }

    // Actualizar departamento de tienda
    async updateDepartmentStore(id_store_dep, departmentStoreData) {
        await pool.execute(
            'UPDATE Department_Store SET id_store = ?, id_department = ? WHERE id_store_dep = ?', 
            [departmentStoreData.id_store, departmentStoreData.id_department, id_store_dep]
        );

        return this.getDepartmentStoreById(id_store_dep);
    }

    // Eliminar departamento de tienda
    async deleteDepartmentStore(id_store_dep) {
        await pool.execute('DELETE FROM Department_Store WHERE id_store_dep = ?', [id_store_dep]);
        return true;
    }

    // Función para obtener departamentos por tienda
    async getDepartmentsByStore(id_store) {
        // Consulta simple sin modificar el nombre
        const [departmentStores] = await pool.execute(
            `SELECT ds.*, d.name_department 
            FROM Department_Store ds
            JOIN Departments d ON ds.id_department = d.id_department
            WHERE ds.id_store = ?`, 
            [id_store]
        );
        
        // Hacemos la transformación en JavaScript
        return departmentStores.map(ds => {
            // Limpiamos el nombre si es necesario
            const cleanName = ds.name_department?.startsWith('TDA-') 
                ? ds.name_department.substring(4) 
                : ds.name_department;
                
            return new DepartmentStore(
                ds.id_store_dep, 
                ds.id_store, 
                ds.id_department, 
                cleanName
            );
        });
    }
}

module.exports = new DepartmentStoreController();