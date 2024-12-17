const pool = require('../connect/connection');
const Position = require('../models/positions');

class PositionController {
    // Obtener todas las posiciones
    async getAllPositions() {
        const [positions] = await pool.execute('SELECT * FROM Positions');
        return positions.map(pos => new Position(pos.id_position, pos.name_position));
    }

    // Obtener posición por ID
    async getPositionById(id_position) {
        const [positions] = await pool.execute(
            'SELECT * FROM Positions WHERE id_position = ?', 
            [id_position]
        );
        
        if (positions.length === 0) return null;
        
        const pos = positions[0];
        return new Position(pos.id_position, pos.name_position);
    }

    // Crear nueva posición
    async createPosition(positionData) {
        const position = new Position(positionData.id_position, positionData.name_position);

        const validationErrors = position.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        await pool.execute(
            'INSERT INTO Positions (id_position, name_position) VALUES (?, ?)', 
            [position.id_position, position.name_position]
        );

        return position;
    }

    // Actualizar posición
    async updatePosition(id_position, positionData) {
        await pool.execute(
            'UPDATE Positions SET name_position = ? WHERE id_position = ?', 
            [positionData.name_position, id_position]
        );

        return this.getPositionById(id_position);
    }

    // Eliminar posición
    async deletePosition(id_position) {
        await pool.execute('DELETE FROM Positions WHERE id_position = ?', [id_position]);
        return true;
    }
}

module.exports = new PositionController();