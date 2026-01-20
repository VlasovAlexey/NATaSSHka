window.fileFormats = {
    // Поддерживаемые форматы изображений (браузер может отображать)
    supportedImageFormats: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/bmp',
        'image/avif',
        'image/apng'
    ],
    
    // Поддерживаемые расширения изображений
    supportedImageExtensions: [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', 
        '.bmp', '.avif', '.apng', '.ico', '.jfif', '.pjpeg', '.pjp'
    ],
    
    // Неподдерживаемые форматы изображений (браузер не может отображать)
    unsupportedImageFormats: [
        'image/tiff',
        'image/tif',
        'image/dds',
        'image/tga',
        'image/psd',
        'image/raw',
        'image/cr2',
        'image/nef',
        'image/dng',
        'image/ico',
        'image/icns',
        'image/eps',
        'image/ai',
        'image/xcf',
        'image/ppm',
        'image/pgm',
        'image/pbm',
        'image/pnm'
    ],
    
    // Неподдерживаемые расширения изображений
    unsupportedImageExtensions: [
        '.tiff', '.tif', '.dds', '.tga', '.psd', '.raw',
        '.cr2', '.nef', '.dng', '.ico', '.icns', '.eps',
        '.ai', '.xcf', '.ppm', '.pgm', '.pbm', '.pnm',
        '.exr', '.hdr', '.heic', '.heif', '.indd', '.cdr',
        '.dwg', '.dxf', '.skp', '.stl', '.obj', '.fbx',
        '.blend', '.max', '.mb', '.ma', '.c4d', '.3ds'
    ],
    
    /**
     * Проверяет, является ли MIME-тип поддерживаемым изображением
     * @param {string} mimeType - MIME-тип файла
     * @returns {boolean} true если поддерживается браузером
     */
    isSupportedImage: function(mimeType) {
        if (!mimeType) return false;
        
        const type = mimeType.toLowerCase();
        
        // Проверяем по MIME-типу
        return this.supportedImageFormats.some(format => 
            type === format || type.startsWith(format.replace('/x-', '/'))
        );
    },
    
    /**
     * Проверяет, является ли MIME-тип неподдерживаемым изображением
     * @param {string} mimeType - MIME-тип файла
     * @returns {boolean} true если это изображение, но не поддерживается браузером
     */
    isUnsupportedImage: function(mimeType) {
        if (!mimeType) return false;
        
        const type = mimeType.toLowerCase();
        
        // Если это вообще не image, возвращаем false
        if (!type.startsWith('image/')) {
            return false;
        }
        
        // Проверяем по списку неподдерживаемых форматов
        return this.unsupportedImageFormats.some(format => 
            type === format || type.startsWith(format.replace('/x-', '/'))
        );
    },
    
    /**
     * Проверяет, является ли файл изображением (любым)
     * @param {string} mimeType - MIME-тип файла
     * @returns {boolean} true если это image/*
     */
    isImage: function(mimeType) {
        if (!mimeType) return false;
        return mimeType.toLowerCase().startsWith('image/');
    },
    
    /**
     * Проверяет по расширению файла
     * @param {string} fileName - Имя файла
     * @returns {Object} Объект с информацией о формате
     */
    checkByExtension: function(fileName) {
        if (!fileName) return { isImage: false, isSupported: false };
        
        const lowerFileName = fileName.toLowerCase();
        const extension = lowerFileName.substring(lowerFileName.lastIndexOf('.'));
        
        const isImage = this.isImageFileByExtension(extension);
        const isSupported = this.supportedImageExtensions.includes(extension);
        
        return {
            isImage: isImage,
            isSupported: isSupported,
            extension: extension,
            shouldDisplayAsFile: isImage && !isSupported
        };
    },
    
    /**
     * Проверяет по расширению, является ли файл изображением
     * @param {string} extension - Расширение файла (с точкой)
     * @returns {boolean} true если это изображение
     */
    isImageFileByExtension: function(extension) {
        if (!extension) return false;
        
        const ext = extension.toLowerCase();
        
        // Проверяем все известные расширения изображений
        return this.supportedImageExtensions.includes(ext) || 
               this.unsupportedImageExtensions.includes(ext);
    },
    
    /**
     * Определяет, как отображать файл
     * @param {string} mimeType - MIME-тип
     * @param {string} fileName - Имя файла
     * @returns {Object} Результат анализа
     */
    analyzeFile: function(mimeType, fileName) {
        const result = {
            isImage: false,
            isSupportedImage: false,
            shouldDisplayAsFile: false,
            mimeType: mimeType,
            fileName: fileName
        };
        
        if (!mimeType && !fileName) {
            return result;
        }
        
        // Сначала проверяем по MIME-типу
        if (mimeType) {
            result.isImage = this.isImage(mimeType);
            result.isSupportedImage = this.isSupportedImage(mimeType);
            result.shouldDisplayAsFile = this.isUnsupportedImage(mimeType);
        }
        
        // Если MIME-типа нет или проверка не дала результата, проверяем по расширению
        if (!mimeType || (!result.isImage && fileName)) {
            const extCheck = this.checkByExtension(fileName);
            result.isImage = result.isImage || extCheck.isImage;
            result.isSupportedImage = result.isSupportedImage || extCheck.isSupported;
            result.shouldDisplayAsFile = result.shouldDisplayAsFile || extCheck.shouldDisplayAsFile;
        }
        
        // Если это изображение, но не поддерживается - показываем как файл
        if (result.isImage && !result.isSupportedImage) {
            result.shouldDisplayAsFile = true;
        }
        
        return result;
    },
    
    /**
     * Получает иконку для типа файла
     * @param {string} mimeType - MIME-тип
     * @param {string} fileName - Имя файла
     * @returns {string} HTML или текст для иконки
     */
    getFileIcon: function(mimeType, fileName) {
        const analysis = this.analyzeFile(mimeType, fileName);
        
        if (analysis.isImage) {
            if (analysis.shouldDisplayAsFile) {
                // Неподдерживаемое изображение - иконка файла изображения
                return '🖼️';
            } else {
                // Поддерживаемое изображение
                return '🖼️';
            }
        }
        
        // Для других типов файлов можно добавить больше иконок
        if (mimeType) {
            if (mimeType.startsWith('video/')) return '🎬';
            if (mimeType.startsWith('audio/')) return '🎵';
            if (mimeType.startsWith('text/')) return '📄';
            if (mimeType.includes('pdf')) return '📕';
            if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
            if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
            if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
            if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️';
        }
        
        // Иконка по умолчанию
        return '📎';
    }
};