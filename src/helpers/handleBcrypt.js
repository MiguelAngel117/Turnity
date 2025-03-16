const bcrypt = require('bcryptjs');
// Método para encriptar la contraseña
const encrypt = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// Método para comparar contraseñas
const compare = async (candidatePassword, realPassword) => {
    return await bcrypt.compare(candidatePassword, realPassword);
}

module.exports = {encrypt, compare};