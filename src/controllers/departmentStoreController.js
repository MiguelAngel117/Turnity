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
            new DepartmentStore(ds.id_store_dep, ds.id_store, ds.id_department, ds.min_opening, ds.max_opening, ds.min_closing, ds.max_closing)
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

        // Clean the department name if it starts with "TDA-"
        departmentStores.forEach(ds => {
            if (ds.name_department?.startsWith('TDA-')) {
            ds.name_department = ds.name_department.substring(4);
            }
        });
        
        if (departmentStores.length === 0) return null;
        
        const ds = departmentStores[0];
        return new DepartmentStore(ds.id_store_dep, ds.id_store, ds.id_department, ds.min_opening, ds.max_opening, ds.min_closing, ds.max_closing);
    }

    // Crear departamento de tienda
    async createDepartmentStore(departmentStoreData) {
        const departmentStore = new DepartmentStore(
            departmentStoreData.id_store_dep,
            departmentStoreData.id_store, 
            departmentStoreData.id_department,
            departmentStoreData.min_opening,
            departmentStoreData.max_opening,
            departmentStoreData.min_closing,
            departmentStoreData.max_closing
        );

        const validationErrors = departmentStore.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        const [result] = await pool.execute(
            'INSERT INTO Department_Store (id_store, id_department, min_opening, max_opening, min_closing, max_closing) VALUES (?, ?, ?, ?, ?, ?)', 
            [departmentStore.id_store, departmentStore.id_department, departmentStore.min_opening, departmentStore.max_opening, departmentStore.min_closing, departmentStore.max_closing]
        );

        departmentStore.id_store_dep = result.insertId;
        return departmentStore;
    }

    // Actualizar departamento de tienda
    async updateDepartmentStore(id_store_dep, departmentStoreData) {
        await pool.execute(
            'UPDATE Department_Store SET id_store = ?, id_department = ?, min_opening = ?, max_opening = ?, min_closing = ?, max_closing = ? WHERE id_store_dep = ?', 
            [departmentStoreData.id_store, departmentStoreData.id_department, departmentStoreData.min_opening, departmentStoreData.max_opening, departmentStoreData.min_closing, departmentStoreData.max_closing, id_store_dep]
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
                
            return {
                id_store_dep: ds.id_store_dep,
                id_store: ds.id_store,
                id_department: ds.id_department,
                name_department: cleanName
            };
                
        });
    }
}

module.exports = new DepartmentStoreController();