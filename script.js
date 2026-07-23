// Configura o worker do PDF.js
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Array global para acumular arquivos de pastas diferentes
let selectedFilesArray = [];

const fileInput = document.getElementById('pdf-files');
const fileInfo = document.getElementById('file-info');
const clearFilesBtn = document.getElementById('clear-files-btn');

// Gerencia a seleção de arquivos de pastas diferentes (acumulando)
fileInput.addEventListener('change', (event) => {
    const newFiles = Array.from(event.target.files);
    
    if (newFiles.length === 0) return;

    // Adiciona os novos arquivos à lista sem duplicar arquivos com o mesmo nome e tamanho
    newFiles.forEach(newFile => {
        const exists = selectedFilesArray.some(f => f.name === newFile.name && f.size === newFile.size);
        if (!exists) {
            selectedFilesArray.push(newFile);
        }
    });

    updateFileInfoUI();
    // Reseta o input para permitir selecionar a mesma pasta/arquivo de novo se precisar
    fileInput.value = '';
});

// Botão para limpar a lista acumulada
clearFilesBtn.addEventListener('click', () => {
    selectedFilesArray = [];
    updateFileInfoUI();
});

function updateFileInfoUI() {
    if (selectedFilesArray.length === 0) {
        fileInfo.classList.add('hidden');
        clearFilesBtn.classList.add('hidden');
    } else {
        fileInfo.classList.remove('hidden');
        clearFilesBtn.classList.remove('hidden');
        fileInfo.innerText = `📄 ${selectedFilesArray.length} arquivo(s) selecionado(s) de pastas diferentes.`;
    }
}

// Evento do botão de processar
document.getElementById('process-btn').addEventListener('click', async () => {
    const keywordInput = document.getElementById('keyword').value.trim();
    const statusArea = document.getElementById('status-area');
    const statusText = document.getElementById('status-text');
    const downloadArea = document.getElementById('download-area');
    const processBtn = document.getElementById('process-btn');

    if (selectedFilesArray.length === 0) {
        alert("Por favor, selecione pelo menos um arquivo PDF.");
        return;
    }
    if (!keywordInput) {
        alert("Por favor, digite uma palavra-chave para buscar.");
        return;
    }

    processBtn.disabled = true;
    downloadArea.classList.add('hidden');
    statusArea.classList.remove('hidden');
    statusText.innerText = "Calculando total de páginas...";

    try {
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();
        let pagesFound = 0;

        // 1. Faz uma varredura rápida prévia para somar o total exato de páginas de todos os arquivos
        let totalPagesGlobal = 0;
        const pdfDocsText = [];
        const pdfDocsEdit = [];

        for (let i = 0; i < selectedFilesArray.length; i++) {
            const file = selectedFilesArray[i];
            const arrayBuffer = await file.arrayBuffer();
            
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDocText = await loadingTask.promise;
            const pdfDocEdit = await PDFDocument.load(arrayBuffer);

            pdfDocsText.push(pdfDocText);
            pdfDocsEdit.push(pdfDocEdit);
            totalPagesGlobal += pdfDocText.numPages;
        }

        // 2. Inicia a varredura real exibindo a contagem em tempo real na tela
        let currentPageGlobal = 0;

        for (let i = 0; i < selectedFilesArray.length; i++) {
            const pdfDocText = pdfDocsText[i];
            const pdfDocEdit = pdfDocsEdit[i];
            const pagesToCopy = [];

            for (let pageNum = 1; pageNum <= pdfDocText.numPages; pageNum++) {
                currentPageGlobal++;
                statusText.innerText = `Lendo página ${currentPageGlobal} de ${totalPagesGlobal}...`;

                const page = await pdfDocText.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');

                if (pageText.toLowerCase().includes(keywordInput.toLowerCase())) {
                    pagesToCopy.push(pageNum - 1);
                }
            }

            if (pagesToCopy.length > 0) {
                const copiedPages = await mergedPdf.copyPages(pdfDocEdit, pagesToCopy);
                copiedPages.forEach((copiedPage) => {
                    mergedPdf.addPage(copiedPage);
                    pagesFound++;
                });
            }
        }

        statusArea.classList.add('hidden');
        processBtn.disabled = false;

        if (pagesFound > 0) {
            downloadArea.classList.remove('hidden');
            document.getElementById('success-message').innerText = `Sucesso! Encontramos ${pagesFound} página(s) com sua palavra-chave.`;
            
            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            
            const downloadBtn = document.getElementById('download-btn');
            const newDownloadBtn = downloadBtn.cloneNode(true);
            downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
            
            newDownloadBtn.addEventListener('click', () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `Extraidos_${keywordInput}.pdf`;
                a.click();
            });
        } else {
            alert(`Nenhuma página contendo a palavra "${keywordInput}" foi encontrada.`);
        }

    } catch (error) {
        console.error(error);
        statusArea.classList.add('hidden');
        processBtn.disabled = false;
        alert("Ocorreu um erro ao processar os arquivos. Verifique se os PDFs não estão corrompidos.");
    }
});
