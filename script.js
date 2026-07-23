// Configura o worker do PDF.js
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let totalPagesGlobal = 0;

// Evento disparado assim que o usuário seleciona os arquivos
document.getElementById('pdf-files').addEventListener('change', async (event) => {
    const files = event.target.files;
    const fileInfo = document.getElementById('file-info');

    if (files.length === 0) {
        fileInfo.classList.add('hidden');
        return;
    }

    fileInfo.classList.remove('hidden');
    fileInfo.innerText = "Lendo informações dos arquivos...";

    let totalPages = 0;

    try {
        for (let i = 0; i < files.length; i++) {
            const arrayBuffer = await files[i].arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDoc = await loadingTask.promise;
            totalPages += pdfDoc.numPages;
        }
        totalPagesGlobal = totalPages;
        fileInfo.innerText = `📄 ${files.length} arquivo(s) carregado(s) | Total: ${totalPages} página(s) pronta(s) para análise.`;
    } catch (error) {
        console.error(error);
        fileInfo.innerText = "⚠️ Erro ao ler o total de páginas dos PDFs.";
    }
});

// Evento do botão de processar
document.getElementById('process-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-files');
    const keywordInput = document.getElementById('keyword').value.trim();
    const statusArea = document.getElementById('status-area');
    const statusText = document.getElementById('status-text');
    const downloadArea = document.getElementById('download-area');
    const processBtn = document.getElementById('process-btn');

    if (fileInput.files.length === 0) {
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

    try {
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();
        let pagesFound = 0;
        let currentPageGlobal = 0;

        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            const arrayBuffer = await file.arrayBuffer();
            
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDocText = await loadingTask.promise;
            const pdfDocEdit = await PDFDocument.load(arrayBuffer);
            const pagesToCopy = [];

            for (let pageNum = 1; pageNum <= pdfDocText.numPages; pageNum++) {
                currentPageGlobal++;
                // Atualização em tempo real na tela
                statusText.innerText = `Analisando página ${currentPageGlobal} de ${totalPagesGlobal || '?'}`;

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
