const XLSX = require('xlsx');

class SimpleExcelImporter {
    async readExcel(filePath) {
        try {
            console.log('Leyendo archivo:', filePath);
            
            // Leer el archivo Excel
            const workbook = XLSX.readFile(filePath);
            
            // Obtener la primera hoja
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convertir a JSON
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            // Imprimir los datos
            console.log('Datos encontrados en el Excel:');
            console.log(JSON.stringify(data, null, 2));
            
            return {
                success: true,
                message: 'Archivo leído correctamente',
                data: data
            };
        } catch (error) {
            console.error('Error al leer el archivo:', error);
            throw new Error(`Error al leer el archivo Excel: ${error.message}`);
        }
    }
}

module.exports = SimpleExcelImporter;