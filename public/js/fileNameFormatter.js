window.fileNameFormatter = {
    formatFileName: function(fileName) {

        if (!fileName || typeof fileName !== 'string') {
            return fileName || '';
        }


        if (fileName.length <= 18) {
            return fileName;
        }

        try {

            const lastDotIndex = fileName.lastIndexOf('.');


            if (lastDotIndex <= 0) {

                const firstPart = fileName.substring(0, 10);
                const lastPart = fileName.length > 13 ?
                    fileName.substring(fileName.length - 3) :
                    fileName.substring(10);
                return `${firstPart}...${lastPart}`;
            }


            const nameWithoutExt = fileName.substring(0, lastDotIndex);
            const extension = fileName.substring(lastDotIndex);


            if (nameWithoutExt.length <= 18) {
                return fileName;
            }


            const firstPart = nameWithoutExt.substring(0, 10);


            const lastPart = nameWithoutExt.length > 13 ?
                nameWithoutExt.substring(nameWithoutExt.length - 3) :
                nameWithoutExt.substring(10);


            return `${firstPart}...${lastPart}${extension}`;

        } catch (error) {
            console.error('Error formatting filename:', error);

            return fileName;
        }
    },


    setupEncryptedFileButton: function(buttonElement, originalFileName) {
        if (!buttonElement || !originalFileName || typeof originalFileName !== 'string') return;

        const formattedName = this.formatFileName(originalFileName);


        const nextSibling = buttonElement.nextElementSibling;
        if (nextSibling && nextSibling.classList.contains('file-info')) {
            if (formattedName !== originalFileName) {
                nextSibling.textContent = formattedName;
                nextSibling.title = originalFileName;
                nextSibling.dataset.formatted = 'true';
            } else if (originalFileName.length > 15) {
                nextSibling.title = originalFileName;
            }
        }
    },


    applyToContainer: function(container) {
        if (!container) return;


        const elements = container.querySelectorAll('.file-info, .file-download-link');

        elements.forEach(element => {

            if (element.dataset.formatted) {
                return;
            }

            const originalText = element.textContent || '';


            const words = originalText.split(/\s+/);

            words.forEach(word => {

                if (word.includes('.') && word.length > 18) {
                    const formatted = this.formatFileName(word);
                    if (formatted !== word) {

                        const newText = originalText.replace(word, formatted);
                        element.textContent = newText;
                        element.title = word;
                        element.dataset.formatted = 'true';
                    }
                }
            });
        });
    },


    formatElementWithFileName: function(element, fileName) {
        if (!element || !fileName) return;

        const formattedName = this.formatFileName(fileName);

        if (formattedName !== fileName) {
            element.textContent = element.textContent.replace(fileName, formattedName);
            element.title = fileName;
            element.dataset.formatted = 'true';
        }
    },


    initializeObserver: function(container) {
        if (!container || !window.MutationObserver) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList && node.classList.contains('message')) {
                            setTimeout(() => {
                                this.applyToContainer(node);
                            }, 50);
                        }
                    });
                }
            });
        });

        observer.observe(container, {
            childList: true,
            subtree: true
        });

        return observer;
    }
};