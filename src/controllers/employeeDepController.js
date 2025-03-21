const pool = require('../connect/connection');
const moment = require('moment');

const EmployeeDepartment = require('../models/employeeDepartment');

class EmployeeDepartmentController {

    async addEmployeesToDepartment(employees) {
        try {
            let insertedEmployees = [];
    
            for (const emp of employees) {
                // Parsear y validar la fecha de contrato, usando el próximo lunes si es necesario
                let contractDate;
                if (emp.contract_date) {
                    // Convertir la fecha del formato DD/MM/YYYY a un objeto moment
                    const inputDate = moment(emp.contract_date, "DD/MM/YYYY");
                    
                    // Verificar si la fecha es válida
                    if (!inputDate.isValid()) {
                        throw new Error(`Fecha de contrato inválida para el empleado ${emp.number_document}`);
                    }
                    
                    // Verificar si la fecha es lunes (isoWeekday 1), si no, obtener el próximo lunes
                    contractDate = inputDate.isoWeekday() === 1 
                        ? inputDate.format("YYYY-MM-DD") 
                        : inputDate.isoWeekday(8).format("YYYY-MM-DD");
                } else {
                    // Si no hay fecha de contrato, usar el próximo lunes como valor predeterminado
                    contractDate = this.getNextMonday();
                }
    
                // Obtener el último registro del empleado
                const [[lastRecord]] = await pool.query(`
                    SELECT working_day, id_store_dep, id_position, contract_date
                    FROM Employees_Department 
                    WHERE number_document = ? 
                    ORDER BY contract_date DESC, id_employee_dep DESC 
                    LIMIT 1
                `, [emp.number_document]);
    
                // Verificar si el nuevo registro caería dentro de la misma semana que otro registro existente
                if (lastRecord) {
                    const lastContractDate = moment(lastRecord.contract_date);
                    const newContractDate = moment(contractDate);
                    
                    // Si las fechas son iguales o el nuevo registro es en la misma semana que el último
                    if (lastContractDate.isSame(newContractDate, 'day') ||
                        (lastContractDate.isoWeek() === newContractDate.isoWeek() && 
                         lastContractDate.year() === newContractDate.year())) {
                        
                        // Si además todos los demás campos son iguales, omitir la inserción
                        if (lastRecord.working_day === emp.working_day &&
                            lastRecord.id_store_dep === emp.id_store_dep &&
                            lastRecord.id_position === emp.id_position) {
                            console.log(`Empleado ${emp.number_document} ya tiene un registro idéntico en la misma semana, omitiendo inserción.`);
                            continue;
                        } else {
                            // Misma semana pero datos diferentes - actualizar en lugar de insertar un nuevo registro
                            const [updateResult] = await pool.query(`
                                UPDATE Employees_Department 
                                SET working_day = ?, id_store_dep = ?, id_position = ?
                                WHERE number_document = ? AND contract_date = ?
                            `, [emp.working_day, emp.id_store_dep, emp.id_position, emp.number_document, lastContractDate.format("YYYY-MM-DD")]);
                            
                            console.log(`Actualizado registro existente para empleado ${emp.number_document} en la misma semana.`);
                            insertedEmployees.push({ 
                                number_document: emp.number_document, 
                                id: lastRecord.id, 
                                action: 'updated'
                            });
                            continue;
                        }
                    }
                }
    
                // Insertar el nuevo registro
                const [result] = await pool.query(`
                    INSERT INTO Employees_Department 
                    (number_document, contract_date, working_day, id_store_dep, id_position) 
                    VALUES (?, ?, ?, ?, ?)
                `, [emp.number_document, contractDate, emp.working_day, emp.id_store_dep, emp.id_position]);
    
                insertedEmployees.push({ 
                    number_document: emp.number_document, 
                    id: result.insertId,
                    contract_date: contractDate,
                    action: 'inserted'
                });
            }
    
            return {
                success: true,
                message: `Se procesaron ${insertedEmployees.length} empleados.`,
                insertedEmployees
            };
        } catch (error) {
            console.error("Error al procesar empleados:", error);
            return { success: false, message: "Error al procesar empleados", error: error.message };
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
            WHERE ed.contract_date = (
                SELECT MAX(ed2.contract_date)
                FROM Employees_Department ed2
                WHERE ed2.number_document = ed.number_document
            )
        `);
    
        const cleanedRows = rows.map(row => ({
            ...row,
            name_store: row.name_store?.startsWith('FALABELLA - ') 
            ? row.name_store.substring(12) 
            : row.name_store,
            name_department: row.name_department?.startsWith('TDA-') 
            ? row.name_department.substring(4) 
            : row.name_department
        }));
    
        return cleanedRows;
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

    // Obtener personas por sucursal y departamento con indicador de turnos
    async getByStoreAndDepartment(storeId, departmentId) {
        // Obtener la fecha actual y establecer el día 15 del mes actual
        const currentDate = moment().format('YYYY-MM-') + '15';
        
        // Generar las semanas del mes actual para obtener el rango de fechas
        const monthRange = await this.generateWeeksPerMonth(currentDate);
        const startDate = monthRange.startDate;
        const endDate = monthRange.endDate;
        
        const [rows] = await pool.query(`
            SELECT ed.*, e.full_name, p.name_position, 
                d.name_department, s.name_store,
                CASE WHEN es.number_document IS NOT NULL THEN TRUE ELSE FALSE END AS has_shifts
            FROM Employees_Department ed
            JOIN Employees e ON e.number_document = ed.number_document
            JOIN Positions p ON p.id_position = ed.id_position
            JOIN Department_Store ds ON ds.id_store_dep = ed.id_store_dep
            JOIN Departments d ON d.id_department = ds.id_department
            JOIN Stores s ON s.id_store = ds.id_store
            JOIN (
                SELECT number_document, MAX(contract_date) AS max_date
                FROM Employees_Department
                GROUP BY number_document
            ) latest ON ed.number_document = latest.number_document AND ed.contract_date = latest.max_date
            LEFT JOIN (
                SELECT DISTINCT number_document 
                FROM Employee_Shift 
                WHERE shift_date BETWEEN ? AND ?
            ) es ON es.number_document = ed.number_document
            WHERE s.id_store = ? AND d.id_department = ?;
        `, [startDate, endDate, storeId, departmentId]);

        return rows;
    }
    
    async generateWeeksPerMonth(date) {
        const inputDate = moment(date, 'YYYY-MM-DD');
        if (!inputDate.isValid()) {
            throw new Error('Invalid date format. Please use YYYY-MM-DD.');
        }

        const startOfMonth = inputDate.clone().startOf('month');
        let firstMonday = startOfMonth.clone().startOf('isoWeek');

        // Si el primer lunes es del mes anterior, avanzar 7 días
        if (firstMonday.isBefore(startOfMonth)) {
            firstMonday.add(7, 'days');
        }

        const weeks = [];
        let currentMonday = firstMonday.clone();

        while (currentMonday.month() === startOfMonth.month()) {
            const weekEnd = currentMonday.clone().endOf('isoWeek');

            weeks.push({
                start: currentMonday.format('YYYY-MM-DD'),
                end: weekEnd.format('YYYY-MM-DD'),
            });

            currentMonday = currentMonday.clone().add(7, 'days');
        }

        return {
            weeks,
            totalWeeks: weeks.length,
            startDate: weeks[0].start,
            endDate: weeks[weeks.length - 1].end
        };
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