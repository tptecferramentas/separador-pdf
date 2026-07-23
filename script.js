// ==========================================
// CONFIGURAÇÃO DO PDF.JS
// ==========================================
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Array global para acumular arquivos de várias importações/pastas diferentes
let selectedFilesArray = [];

const fileInput = document.getElementById('pdf-files');
const fileListContainer = document.getElementById('file-list-container');
const fileUl = document.getElementById('file-ul');
const clearAllBtn = document.getElementById('clear-all-btn');

// ==========================================
// 1. GERENCIAMENTO DE ACUMULAÇÃO DE ARQUIVOS
// ==========================================
fileInput.addEventListener('change', (event) => {
    const newFiles = Array.from(event.target.files);
    
    if (newFiles.length === 0) return;

    // Adiciona apenas os arquivos que ainda não estão na lista (evita duplicados idênticos)
    newFiles.forEach(newFile => {
        const exists = selectedFilesArray.some(f => f.name === newFile.name && f.size === newFile.size);
        if (!exists) {
            selectedFilesArray.push(newFile);
        }
    });

    renderFileList();
    fileInput.value = ''; // Reseta o input para permitir selecionar novos arquivos da mesma pasta ou de outra
});

// Remove um arquivo específico da lista acumulada
window.removeFile = function(index) {
    selectedFilesArray.splice(index, 1);
    renderFileList();
};

// Limpa todos os arquivos da lista
clearAllBtn.addEventListener('click', () => {
    selectedFilesArray = [];
    renderFileList();
});

// Atualiza a interface visual da lista de arquivos
function renderFileList() {
    fileUl.innerHTML = '';
    
    if (selectedFilesArray.length === 0) {
        fileListContainer.classList.add('hidden');
        return;
    }

    fileListContainer.classList.remove('hidden');

    selectedFilesArray.forEach((file, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>📄 ${file.name}</span>
            <button class="remove-file-btn" onclick="removeFile(${index})" title="Remover arquivo">Remover</button>
        `;
        fileUl.appendChild(li);
    });
}

// ==========================================
// 2. PROCESSAMENTO E BUSCA NO PDF
// ==========================================
document.getElementById('process-btn').addEventListener('click', async () => {
    const keywordInput = document.getElementById('keyword').value.trim();
    const statusArea = document.getElementById('status-area');
    const statusText = document.getElementById('status-text');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const downloadArea = document.getElementById('download-area');
    const processBtn = document.getElementById('process-btn');

    // Validações iniciais
    if (selectedFilesArray.length === 0) {
        alert("Por favor, selecione pelo menos um arquivo PDF.");
        return;
    }
    if (!keywordInput) {
        alert("Por favor, digite uma palavra-chave para buscar.");
        return;
    }

    // Prepara a interface para o carregamento
    processBtn.disabled = true;
    downloadArea.classList.add('hidden');
    statusArea.classList.remove('hidden');
    statusText.innerText = "Calculando total de páginas...";
    progressBarFill.style.width = '0%';

    try {
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();
        let pagesFound = 0;

        // Passo A: Pré-leitura para calcular o total global de páginas de todos os arquivos acumulados
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

        // Passo B: Varredura página por página com porcentagem e contagem em tempo real
        let currentPageGlobal = 0;

        for (let i = 0; i < selectedFilesArray.length; i++) {
            const pdfDocText = pdfDocsText[i];
            const pdfDocEdit = pdfDocsEdit[i];
            const pagesToCopy = [];

            for (let pageNum = 1; pageNum <= pdfDocText.numPages; pageNum++) {
                currentPageGlobal++;
                
                // Calcula a porcentagem exata
                const percent = ((currentPageGlobal / totalPagesGlobal) * 100).toFixed(1);
                
                // Atualiza o texto e a barra de progresso visual
                statusText.innerText = `Lendo página ${currentPageGlobal} de ${totalPagesGlobal} (${percent}%)`;
                progressBarFill.style.width = `${percent}%`;

                // Extrai texto da página atual
                const page = await pdfDocText.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');

                // Verifica se a palavra-chave existe na página (ignorando maiúsculas/minúsculas)
                if (pageText.toLowerCase().includes(keywordInput.toLowerCase())) {
                    pagesToCopy.push(pageNum - 1); // PDF-lib usa índice baseado em 0
                }
            }

            // Se encontrou correspondências neste arquivo, copia para o PDF final
            if (pagesToCopy.length > 0) {
                const copiedPages = await mergedPdf.copyPages(pdfDocEdit, pagesToCopy);
                copiedPages.forEach((copiedPage) => {
                    mergedPdf.addPage(copiedPage);
                    pagesFound++;
                });
            }
        }

        // Oculta a área de status e reativa o botão
        statusArea.classList.add('hidden');
        processBtn.disabled = false;

        // Passo C: Se encontrou páginas, gera o arquivo para download
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
            alert(`Nenhuma página contendo a palavra "${keywordInput}" foi encontrada nos arquivos selecionados.`);
        }

    } catch (error) {
        console.error("Erro no processamento:", error);
        statusArea.classList.add('hidden');
        processBtn.disabled = false;
        alert("Ocorreu um erro ao processar os arquivos. Verifique se os PDFs não estão corrompidos ou protegidos por senha.");
    }
});
