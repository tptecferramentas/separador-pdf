// Configura o worker do PDF.js (Necessário para a biblioteca funcionar no navegador)
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

document.getElementById('process-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-files');
    const keywordInput = document.getElementById('keyword').value.trim();
    const statusArea = document.getElementById('status-area');
    const statusText = document.getElementById('status-text');
    const downloadArea = document.getElementById('download-area');
    const processBtn = document.getElementById('process-btn');

    // Validações
    if (fileInput.files.length === 0) {
        alert("Por favor, selecione pelo menos um arquivo PDF.");
        return;
    }
    if (!keywordInput) {
        alert("Por favor, digite uma palavra-chave para buscar.");
        return;
    }

    // Prepara a interface
    processBtn.disabled = true;
    downloadArea.classList.add('hidden');
    statusArea.classList.remove('hidden');
    statusText.innerText = "Lendo e buscando arquivos... Isso pode levar um tempo dependendo do tamanho.";

    try {
        const { PDFDocument } = PDFLib;
        // Cria um novo PDF em branco onde vamos colar as páginas encontradas
        const mergedPdf = await PDFDocument.create();
        let pagesFound = 0;

        // Loop por cada arquivo selecionado
        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            const arrayBuffer = await file.arrayBuffer();
            
            // 1. Lê o PDF usando PDF.js para extrair o texto
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDocText = await loadingTask.promise;
            
            // 2. Lê o PDF usando pdf-lib para manipulação
            const pdfDocEdit = await PDFDocument.load(arrayBuffer);
            const pagesToCopy = [];

            // Loop por cada página do arquivo atual
            for (let pageNum = 1; pageNum <= pdfDocText.numPages; pageNum++) {
                const page = await pdfDocText.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Junta todo o texto da página em uma única string
                const pageText = textContent.items.map(item => item.str).join(' ');

                // Faz a busca da palavra-chave (ignorando letras maiúsculas/minúsculas)
                if (pageText.toLowerCase().includes(keywordInput.toLowerCase())) {
                    pagesToCopy.push(pageNum - 1); // pdf-lib conta páginas a partir do zero (0)
                }
            }

            // Se achou páginas com a palavra neste arquivo, copia elas para o novo PDF
            if (pagesToCopy.length > 0) {
                const copiedPages = await mergedPdf.copyPages(pdfDocEdit, pagesToCopy);
                copiedPages.forEach((copiedPage) => {
                    mergedPdf.addPage(copiedPage);
                    pagesFound++;
                });
            }
        }

        // Finalização
        statusArea.classList.add('hidden');
        processBtn.disabled = false;

        if (pagesFound > 0) {
            downloadArea.classList.remove('hidden');
            
            // Gera o PDF final
            const pdfBytes = await mergedPdf.save();
            
            // Configura o botão de download
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            
            const downloadBtn = document.getElementById('download-btn');
            // Remove listeners antigos caso o usuário clique várias vezes
            const newDownloadBtn = downloadBtn.cloneNode(true);
            downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
            
            newDownloadBtn.addEventListener('click', () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `Extraidos_${keywordInput}.pdf`;
                a.click();
            });
        } else {
            alert(`Nenhuma página contendo a palavra "${keywordInput}" foi encontrada nos PDFs fornecidos.`);
        }

    } catch (error) {
        console.error(error);
        statusArea.classList.add('hidden');
        processBtn.disabled = false;
        alert("Ocorreu um erro ao processar os arquivos. Verifique se os PDFs são válidos e não estão protegidos por senha.");
    }
});