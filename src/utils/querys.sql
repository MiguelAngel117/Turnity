CREATE TABLE Employees_Department (
    number_document INT NOT NULL,    -- Parte de la clave primaria (ID del empleado)
    id_store_dep INT NOT NULL,       -- Parte de la clave primaria (ID del departamento en la tienda)
    id_position INT NOT NULL,        -- Clave foránea hacia la tabla Positions

    -- Definir clave primaria compuesta
    PRIMARY KEY (number_document, id_store_dep),

    -- Claves foráneas
    CONSTRAINT FK_EmployeesDep_StoreDep FOREIGN KEY (id_store_dep) 
        REFERENCES Department_Store (id_store_dep) ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT FK_EmployeesDep_Position FOREIGN KEY (id_position) 
        REFERENCES Positions (id_position) ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT FK_EmployeesDep_Employee FOREIGN KEY (number_document) 
        REFERENCES Employees (number_document) ON DELETE CASCADE ON UPDATE CASCADE
);
