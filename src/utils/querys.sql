CREATE DATABASE turnity;
USE turnity;
-- Tabla Employees
CREATE TABLE Employees (
    number_document INT PRIMARY KEY,
    num_doc_manager INT,
    full_name VARCHAR(250) NOT NULL,
    CONSTRAINT FK_Manager FOREIGN KEY (num_doc_manager) REFERENCES Employees (number_document)
);

-- Tabla Stores
CREATE TABLE Stores (
    id_store INT PRIMARY KEY NOT NULL,
    name_store VARCHAR(100) NOT NULL,
    hour_open_store DECIMAL(3,1) NOT NULL,
    hour_close_store DECIMAL(3,1) NOT NULL
); 

-- Tabla Departments
CREATE TABLE Departments (
    id_department INT PRIMARY KEY,
    name_department VARCHAR(100) NOT NULL
);

-- Tabla Department_Store (entidad débil)
CREATE TABLE Department_Store (
    id_store_dep INT PRIMARY KEY,
    id_store INT NOT NULL,
    id_department INT NOT NULL,
    min_opening INT NOT NULL,
    max_opening INT NOT NULL,
    min_closing INT NOT NULL,
    max_closing INT NOT NULL,
    CONSTRAINT FK_DepartmentStore_Store FOREIGN KEY (id_store) REFERENCES Stores (id_store),
    CONSTRAINT FK_DepartmentStore_Department FOREIGN KEY (id_department) REFERENCES Departments (id_department)
);

-- Tabla Positions
CREATE TABLE Positions (
    id_position INT PRIMARY KEY,
    name_position VARCHAR(100) NOT NULL
);

-- Tabla Employees_Department
CREATE TABLE Employees_Department (
    id_employee_dep INT AUTO_INCREMENT PRIMARY KEY,
    number_document INT NOT NULL,-- Clave foránea hacia employees
    contract_date DATE NOT NULL, -- Jornada  del trabajador  
    working_day INT NOT NULL,
    id_store_dep INT NOT NULL,       -- Clave foránea hacia Department_Store
    id_position INT NOT NULL,        -- Clave foránea hacia Positions
    CONSTRAINT FK_EmployeesDep_StoreDep FOREIGN KEY (id_store_dep) REFERENCES Department_Store (id_store_dep),
    CONSTRAINT FK_EmployeesDep_Position FOREIGN KEY (id_position) REFERENCES Positions (id_position),
    CONSTRAINT FK_EmployeesDep_Employee FOREIGN KEY (number_document) REFERENCES Employees (number_document)
);
 
CREATE TABLE Shifts (
    code_shift VARCHAR(250) PRIMARY KEY,
    hours INT NOT NULL,
    initial_hour TIME NOT NULL,
    end_hour TIME NOT NULL
);
-- Tabla Shifts(Historial de Turnos)
CREATE TABLE Employee_Shift (
    number_document INT NOT NULL,
    shift_date DATE NOT NULL,
    turn VARCHAR(250) NOT NULL,
    break VARCHAR(100) NOT NULL,
    CONSTRAINT PK_Employee_Shift PRIMARY KEY (number_document, shift_date),  -- La clave primaria es la combinación de número de documento y fecha
    CONSTRAINT FK_ShiftHistory_Employee FOREIGN KEY (number_document) REFERENCES Employees (number_document),
    CONSTRAINT UC_Employee_ShiftDate UNIQUE (number_document, shift_date),  -- Asegura que no haya dos registros en la misma fecha para la misma persona
    CONSTRAINT Fk_History_Employee FOREIGN KEY (turn) REFERENCES Shifts (code_shift)
);


-- Tabla Users (Usuarios del sistema)
	CREATE TABLE Users (
		number_document VARCHAR(20) PRIMARY KEY,
		alias_user VARCHAR(50) NOT NULL UNIQUE,
		first_names VARCHAR(100) NOT NULL,
		last_names VARCHAR(100) NOT NULL,
		email VARCHAR(100) NOT NULL UNIQUE,
		password VARCHAR(255) NOT NULL,
		status_user BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
	);

	-- Tabla Roles (usando el nombre del rol como clave primaria)
	CREATE TABLE Roles (
		role_name VARCHAR(50) PRIMARY KEY,
		description VARCHAR(255)
	);

	-- Tabla User_Role (usando number_document como referencia)
	CREATE TABLE User_Role (
		id_user_role INT AUTO_INCREMENT PRIMARY KEY,
		number_document VARCHAR(20) NOT NULL,
		role_name VARCHAR(50) NOT NULL,
		CONSTRAINT FK_UserRole_User FOREIGN KEY (number_document) REFERENCES Users (number_document),
		CONSTRAINT FK_UserRole_Role FOREIGN KEY (role_name) REFERENCES Roles (role_name),
		CONSTRAINT UC_User_Role UNIQUE (number_document, role_name)
	);

	-- Tabla User_Store_Access (usando number_document como referencia)
	CREATE TABLE User_Store_Access (
		number_document VARCHAR(20) NOT NULL,
		id_store INT NOT NULL,
		PRIMARY KEY (number_document, id_store),
		CONSTRAINT FK_UserStore_User FOREIGN KEY (number_document) REFERENCES Users (number_document),
		CONSTRAINT FK_UserStore_Store FOREIGN KEY (id_store) REFERENCES Stores (id_store)
	);

	-- Tabla User_Department_Access con llave compuesta
	CREATE TABLE User_Department_Access (
		number_document VARCHAR(20) NOT NULL,
		id_store INT NOT NULL,
		id_department INT NOT NULL,
		PRIMARY KEY (number_document, id_store, id_department),
		CONSTRAINT FK_UserDepartment_User FOREIGN KEY (number_document) REFERENCES Users (number_document),
		CONSTRAINT FK_UserDepartment_Store FOREIGN KEY (id_store) REFERENCES Stores (id_store),
		CONSTRAINT FK_UserDepartment_Department FOREIGN KEY (id_department) REFERENCES Departments (id_department)
	);
-- Procedimiento almacenado para asignar permisos según el rol
DELIMITER //
CREATE PROCEDURE AssignUserPermissions(IN p_number_document VARCHAR(20), IN p_role_name VARCHAR(50))
BEGIN
    -- Si es admin, dar acceso a todas las tiendas
    IF p_role_name = 'Administrador' THEN
        -- Eliminar accesos anteriores
        DELETE FROM User_Store_Access WHERE number_document = p_number_document;
        DELETE FROM User_Department_Access WHERE number_document = p_number_document;
        
        -- Insertar acceso a todas las tiendas
        INSERT INTO User_Store_Access (number_document, id_store)
        SELECT p_number_document, id_store FROM Stores;
        
        -- Insertar acceso a todos los departamentos de todas las tiendas
        INSERT INTO User_Department_Access (number_document, id_store, id_department)
        SELECT p_number_document, ds.id_store, ds.id_department 
        FROM Department_Store ds;
        
    END IF;
    
    -- Para otros roles, los permisos se asignarán manualmente
    
END //
DELIMITER ;

DELIMITER //

CREATE PROCEDURE AssignUserPermissionsSpecificStores(
    IN p_number_document VARCHAR(20), 
    IN p_role_name VARCHAR(50),
    IN p_store_ids TEXT  -- Lista de IDs de tiendas separadas por comas
)
BEGIN
    -- Eliminar accesos anteriores del usuario
    DELETE FROM User_Store_Access WHERE number_document = p_number_document;
    DELETE FROM User_Department_Access WHERE number_document = p_number_document;

    -- Insertar acceso solo a las tiendas especificadas
    INSERT INTO User_Store_Access (number_document, id_store)
    SELECT p_number_document, id_store 
    FROM Stores 
    WHERE FIND_IN_SET(id_store, p_store_ids);

    -- Insertar acceso a todos los departamentos de esas tiendas
    INSERT INTO User_Department_Access (number_document, id_store, id_department)
    SELECT p_number_document, ds.id_store, ds.id_department
    FROM Department_Store ds
    WHERE FIND_IN_SET(ds.id_store, p_store_ids);
    
END //

DELIMITER ;

DELIMITER //
CREATE PROCEDURE AssignUserPermissionsSpecificDepartments(
    IN p_number_document VARCHAR(20),
    IN p_role_name VARCHAR(50),
    IN p_id_store INT,  -- ID de la tienda específica
    IN p_department_ids TEXT  -- Lista de IDs de departamentos separadas por comas
)
BEGIN
    -- Eliminar accesos anteriores del usuario
    DELETE FROM User_Store_Access WHERE number_document = p_number_document;
    DELETE FROM User_Department_Access WHERE number_document = p_number_document;
    
    -- Insertar acceso a la tienda específica
    INSERT INTO User_Store_Access (number_document, id_store)
    VALUES (p_number_document, p_id_store);
    
    -- Insertar acceso solo a los departamentos especificados de esa tienda
    INSERT INTO User_Department_Access (number_document, id_store, id_department)
    SELECT p_number_document, p_id_store, id_department
    FROM Department_Store
    WHERE id_store = p_id_store
    AND FIND_IN_SET(id_department, p_department_ids);
    
END //
DELIMITER ;