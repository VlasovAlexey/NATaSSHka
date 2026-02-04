window.fileFormats = {
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
    supportedImageExtensions: [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
        '.bmp', '.avif', '.apng', '.ico', '.jfif', '.pjpeg', '.pjp'
    ],
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
    unsupportedImageExtensions: [
        '.tiff', '.tif', '.dds', '.tga', '.psd', '.raw',
        '.cr2', '.nef', '.dng', '.ico', '.icns', '.eps',
        '.ai', '.xcf', '.ppm', '.pgm', '.pbm', '.pnm',
        '.exr', '.hdr', '.heic', '.heif', '.indd', '.cdr',
        '.dwg', '.dxf', '.skp', '.stl', '.obj', '.fbx',
        '.blend', '.max', '.mb', '.ma', '.c4d', '.3ds'
    ],
    isSupportedImage: function(mimeType) {
        if (!mimeType) return false;
        const type = mimeType.toLowerCase();
        return this.supportedImageFormats.some(format =>
            type === format || type.startsWith(format.replace('/x-', '/'))
        );
    },
    isUnsupportedImage: function(mimeType) {
        if (!mimeType) return false;
        const type = mimeType.toLowerCase();
        if (!type.startsWith('image/')) {
            return false;
        }
        return this.unsupportedImageFormats.some(format =>
            type === format || type.startsWith(format.replace('/x-', '/'))
        );
    },
    isImage: function(mimeType) {
        if (!mimeType) return false;
        return mimeType.toLowerCase().startsWith('image/');
    },
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
    isImageFileByExtension: function(extension) {
        if (!extension) return false;
        const ext = extension.toLowerCase();
        return this.supportedImageExtensions.includes(ext) ||
               this.unsupportedImageExtensions.includes(ext);
    },
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
        if (mimeType) {
            result.isImage = this.isImage(mimeType);
            result.isSupportedImage = this.isSupportedImage(mimeType);
            result.shouldDisplayAsFile = this.isUnsupportedImage(mimeType);
        }
        if (!mimeType || (!result.isImage && fileName)) {
            const extCheck = this.checkByExtension(fileName);
            result.isImage = result.isImage || extCheck.isImage;
            result.isSupportedImage = result.isSupportedImage || extCheck.isSupported;
            result.shouldDisplayAsFile = result.shouldDisplayAsFile || extCheck.shouldDisplayAsFile;
        }
        if (result.isImage && !result.isSupportedImage) {
            result.shouldDisplayAsFile = true;
        }
        return result;
    },
    getFileIcon: function(mimeType, fileName) {
        const analysis = this.analyzeFile(mimeType, fileName);
        if (analysis.isImage) {
            if (analysis.shouldDisplayAsFile) {
                return '🖼️';
            } else {
                return '🖼️';
            }
        }
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
        return '📎';
    }
};