require('dotenv').config();
const jwt = require('jsonwebtoken');

const tokenSign = async (user) => {
    try {
        return jwt.sign(
            {
                number_document: user.number_document,
                roles: user.roles
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "4h",
            }
        ); 
    } catch (error) {
        return "TOKEN EXPIRED";
    }
};

const verifyToken = async (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return false;
    }
};

module.exports = { tokenSign, verifyToken };