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
const contactBtn = document.getElementById('fab-contact');
const contactModal = document.getElementById('contact-modal');
const closeContact = document.getElementById('close-contact');
const contactForm = document.getElementById('contact-form');

contactBtn.addEventListener('click', () => contactModal.classList.add('active'));
closeContact.addEventListener('click', () => contactModal.classList.remove('active'));

// Processar Envio do Formulário (FormSubmit com Header Accept)
contactForm.addEventListener('submit', (e) => {
    e.preventDefault(); 

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.innerText = "Enviando..."; 
    submitBtn.disabled = true;

    const formData = new FormData(contactForm);

    fetch("https://formsubmit.co/ajax/tptectecnologias@gmail.com", {
        method: "POST",
        headers: { 
            'Accept': 'application/json'
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        alert("✅ Mensagem enviada com sucesso! Entraremos em contato em breve.");
        contactModal.classList.remove('active'); 
        contactForm.reset(); 
    })
    .catch(error => {
        alert("❌ Ocorreu um erro ao enviar. Verifique sua conexão.");
        console.error(error);
    })
    .finally(() => {
        submitBtn.innerText = "Enviar Mensagem";
        submitBtn.disabled = false;
    });
});

const ocrModal = document.getElementById('ocr-modal');
const closeOcr = document.getElementById('close-ocr');
const btnCloseOcrAlt = document.getElementById('btn-close-ocr-alt');

closeOcr.addEventListener('click', () => ocrModal.classList.remove('active'));
btnCloseOcrAlt.addEventListener('click', () => ocrModal.classList.remove('active'));

window.addEventListener('click', (e) => {
    if (e.target === contactModal) contactModal.classList.remove('active');
    if (e.target === ocrModal) ocrModal.classList.remove('active');
});
