const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const ExcelJS = require('exceljs');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow requests to localhost
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'logo.png'), // Updated logo path
    title: 'Sistema de Relatórios - Clientes Novotok',
    autoHideMenuBar: true, // Hide menu bar
    menuBarVisible: false,   // Ensure menu bar is not visible
    frame: false, // Remove default frame to use custom title bar
    backgroundColor: '#ffffff', // White background
    titleBarStyle: 'hiddenInset' // Hide title bar on macOS
  });

  // Remove the menu completely
  mainWindow.setMenu(null);

  mainWindow.loadFile('login.html');

  // Open DevTools
  // mainWindow.openDevTools();

}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Window control handlers
ipcMain.handle('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow.close();
});

// Export to Excel handler
ipcMain.handle('export-to-excel', async (event, exportData) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório de Clientes');

    // Handle both old format (direct data array) and new format (object with data and columns)
    let data, columns;
    
    if (Array.isArray(exportData)) {
      // Old format - export all columns (excluding CLASSEVENDA per spec)
      data = exportData;
      columns = [
        { header: 'Código do Cliente', key: 'CODCLI', width: 15 },
        { header: 'Nome do Cliente', key: 'CLIENTE', width: 30 },
        { header: 'Código do Vendedor', key: 'CODUSUR1', width: 18 },
        { header: 'Telefone', key: 'TELCELENT', width: 15 },
        { header: 'CGCENT', key: 'CGCENT', width: 20 },
        { header: 'Endereço', key: 'ENDERENT', width: 30 },
        { header: 'Bairro', key: 'BAIRROENT', width: 20 },
        { header: 'Município', key: 'MUNICENT', width: 20 },
        { header: 'Estado', key: 'ESTENT', width: 10 },
        { header: 'Cod. Vendedor 2', key: 'CODUSUR2', width: 18 },
        { header: 'Quantidade', key: 'QT', width: 12 },
        { header: 'Valor Venda', key: 'VLVENDA', width: 15 },
        { header: 'Custo Financeiro', key: 'VLCUSTOFIN', width: 18 },
        { header: 'Peso Total', key: 'TOTPESO', width: 12 }
      ];
    } else {
      // New format - export only selected columns
      data = exportData.data;
      columns = exportData.columns.map(col => {
        // Define default widths for each column type (excluding CLASSEVENDA)
        const widthMap = {
          'CODCLI': 15,
          'CLIENTE': 30,
          'CODUSUR1': 18,
          'TELCELENT': 15,
          'CGCENT': 20,
          'ENDERENT': 30,
          'BAIRROENT': 20,
          'MUNICENT': 20,
          'ESTENT': 10,
          'CODUSUR2': 18,
          'QT': 12,
          'VLVENDA': 15,
          'VLCUSTOFIN': 18,
          'TOTPESO': 12
        };
        
        return {
          header: col.header,
          key: col.key,
          width: widthMap[col.key] || 15
        };
      });
    }

    // Set column headers
    worksheet.columns = columns;

    // Add data rows
    data.forEach(row => {
      worksheet.addRow(row);
    });

    // Style the header row
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      };
      cell.alignment = { horizontal: 'center' };
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.header) {
        column.width = Math.max(column.width, column.header.length + 2);
      }
    });

    // Save file dialog
    const selectedColumnsCount = Array.isArray(exportData) ? 'todas' : exportData.columns.length;
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Relatório',
      defaultPath: `relatorio-clientes-${selectedColumnsCount}-colunas-${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] }
      ]
    });

    if (filePath) {
      await workbook.xlsx.writeFile(filePath);
      return {
        success: true,
        message: 'Arquivo exportado com sucesso!',
        filePath
      };
    } else {
      return {
        success: false,
        message: 'Exportação cancelada pelo usuário.'
      };
    }

  } catch (error) {
    console.error('Excel export error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});