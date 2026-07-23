// ==========================================
// CONFIGURAÇÃO DO PDF.JS
// ==========================================
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let selectedFilesArray = [];

const fileInput = document.getElementById('pdf-files');
const fileListContainer = document.getElementById('file-list-container');
const fileUl = document.getElementById('file-ul');
const clearAllBtn = document.getElementById('clear-all-btn');

// ==========================================
// 1. CARREGAMENTO DA PÁGINA (SUPER RÁPIDO)
// ==========================================
// A tela de carregamento some assim que a estrutura HTML estiver pronta,
// permitindo que os anúncios carreguem sem atrasar a visualização da ferramenta.
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('page-loader');
    loader.style.opacity = '0';
    
    setTimeout(() => {
        loader.style.display = 'none';
    }, 500);
});

// ==========================================
// 2. GERENCIAMENTO DE ARQUIVOS
// ==========================================
fileInput.addEventListener('change', (event) => {
    const newFiles = Array.from(event.target.files);
    if (newFiles.length === 0) return;

    newFiles.forEach(newFile => {
        const exists = selectedFilesArray.some(f => f.name === newFile.name && f.size === newFile.size);
        if (!exists) selectedFilesArray.push(newFile);
    });

    renderFileList();
    fileInput.value = ''; 
});

window.removeFile = function(index) {
    selectedFilesArray.splice(index, 1);
    renderFileList();
};

clearAllBtn.addEventListener('click', () => {
    selectedFilesArray = [];
    renderFileList();
});

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
// 3. PROCESSAMENTO DO PDF E MODAL OCR
// ==========================================
document.getElementById('process-btn').addEventListener('click', async () => {
    const keywordInput = document.getElementById('keyword').value.trim();
    const statusArea = document.getElementById('status-area');
    const statusText = document.getElementById('status-text');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const downloadArea = document.getElementById('download-area');
    const processBtn = document.getElementById('process-btn');

    if (selectedFilesArray.length === 0) return alert("Selecione pelo menos um arquivo PDF.");
    if (!keywordInput) return alert("Digite uma palavra-chave para buscar.");

    processBtn.disabled = true;
    downloadArea.classList.add('hidden');
    statusArea.classList.remove('hidden');
    statusText.innerText = "Calculando total de páginas...";
    progressBarFill.style.width = '0%';

    try {
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();
        let pagesFound = 0;
        let totalPagesGlobal = 0;
        const pdfDocsText = [];
        const pdfDocsEdit = [];

        // Pre-leitura
        for (let i = 0; i < selectedFilesArray.length; i++) {
            const arrayBuffer = await selectedFilesArray[i].arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDocText = await loadingTask.promise;
            const pdfDocEdit = await PDFDocument.load(arrayBuffer);

            pdfDocsText.push(pdfDocText);
            pdfDocsEdit.push(pdfDocEdit);
            totalPagesGlobal += pdfDocText.numPages;
        }

        // Varredura
        let currentPageGlobal = 0;
        for (let i = 0; i < selectedFilesArray.length; i++) {
            const pdfDocText = pdfDocsText[i];
            const pdfDocEdit = pdfDocsEdit[i];
            const pagesToCopy = [];

            for (let pageNum = 1; pageNum <= pdfDocText.numPages; pageNum++) {
                currentPageGlobal++;
                const percent = ((currentPageGlobal / totalPagesGlobal) * 100).toFixed(1);
                
                statusText.innerText = `Lendo página ${currentPageGlobal} de ${totalPagesGlobal} (${percent}%)`;
                progressBarFill.style.width = `${percent}%`;

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
            // Se não achar nada, abre o Modal de Oferta/OCR
            document.getElementById('ocr-modal').classList.add('active');
        }

    } catch (error) {
        console.error("Erro no processamento:", error);
        statusArea.classList.add('hidden');
        processBtn.disabled = false;
        alert("Ocorreu um erro. O arquivo pode estar corrompido ou protegido.");
    }
});

// ==========================================
// 4. LÓGICA DOS MODAIS (CONTATO E OCR)
// ==========================================

// Elementos Modal Contato
const contactBtn = document.getElementById('fab-contact');
const contactModal = document.getElementById('contact-modal');
const closeContact = document.getElementById('close-contact');
const contactForm = document.getElementById('contact-form');

// Abrir e Fechar Modal de Contato
contactBtn.addEventListener('click', () => contactModal.classList.add('active'));
closeContact.addEventListener('click', () => contactModal.classList.remove('active'));

// Processar Envio do Formulário (Abre cliente de E-mail formatado)
contactForm.addEventListener('submit', (e) => {
    e.preventDefault(); 

    const email = document.getElementById('contato-email').value;
    const zap = document.getElementById('contato-zap').value || 'Não informado';
    const msg = document.getElementById('contato-msg').value;

    const assunto = encodeURIComponent("Novo Contato - Site TP tec");
    const corpo = encodeURIComponent(
        `E-mail de retorno: ${email}\nWhatsApp: ${zap}\n\nMensagem:\n${msg}`
    );

    // Abre o app de e-mail padrão do usuário já preenchido
    window.location.href = `mailto:tptectecnologias@gmail.com?subject=${assunto}&body=${corpo}`;
    
    // Fecha o modal e limpa form
    contactModal.classList.remove('active');
    contactForm.reset();
});

// Elementos Modal OCR
const ocrModal = document.getElementById('ocr-modal');
const closeOcr = document.getElementById('close-ocr');
const btnCloseOcrAlt = document.getElementById('btn-close-ocr-alt');

// Fechar Modal OCR
closeOcr.addEventListener('click', () => ocrModal.classList.remove('active'));
btnCloseOcrAlt.addEventListener('click', () => ocrModal.classList.remove('active'));

// Fecha modais ao clicar fora da caixa branca
window.addEventListener('click', (e) => {
    if (e.target === contactModal) contactModal.classList.remove('active');
    if (e.target === ocrModal) ocrModal.classList.remove('active');
});
