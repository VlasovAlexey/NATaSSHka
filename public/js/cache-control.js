class CacheControlManager {
    constructor() {
        this.antiCacheEnabled = true;
        this.init();
    }
    init() {
        if (document.head) {
            this.addMetaTags();
        }
        this.interceptFetch();
        this.interceptXHR();
        this.monitorResourceLoading();
    }
    addMetaTags() {
        const metaTags = [
            { httpEquiv: 'Cache-Control', content: 'no-store, no-cache, must-revalidate, private' },
            { httpEquiv: 'Pragma', content: 'no-cache' },
            { httpEquiv: 'Expires', content: '0' }
        ];
        metaTags.forEach(meta => {
            const metaElement = document.createElement('meta');
            metaElement.httpEquiv = meta.httpEquiv;
            metaElement.content = meta.content;
            document.head.appendChild(metaElement);
        });
    }
    interceptFetch() {
        const originalFetch = window.fetch;
        window.fetch = (input, init = {}) => {
            const headers = {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                ...init.headers
            };
            let url = input;
            if (typeof input === 'string') {
                url = this.addAntiCacheParam(input);
            }
            return originalFetch(url, {
                ...init,
                headers,
                cache: 'no-store'
            });
        };
    }
    interceptXHR() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            const antiCacheUrl = window.cacheControlManager?.addAntiCacheParam(url) || url;
            return originalOpen.call(this, method, antiCacheUrl, ...args);
        };
        XMLHttpRequest.prototype.send = function(body) {
            this.setRequestHeader('Cache-Control', 'no-cache');
            this.setRequestHeader('Pragma', 'no-cache');
            return originalSend.call(this, body);
        };
    }
    monitorResourceLoading() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        this.processElement(node);
                    }
                });
            });
        });
        observer.observe(document, {
            childList: true,
            subtree: true
        });
        document.querySelectorAll('img, video, audio, link[rel="stylesheet"], script[src]').forEach(el => {
            this.processElement(el);
        });
    }
    processElement(element) {
        const tagName = element.tagName.toLowerCase();
        switch(tagName) {
            case 'img':
            case 'video':
            case 'audio':
                if (element.src && !element.src.includes('blob:')) {
                    element.src = this.addAntiCacheParam(element.src);
                }
                break;
            case 'link':
                if (element.rel === 'stylesheet' && element.href) {
                    element.href = this.addAntiCacheParam(element.href);
                }
                break;
            case 'script':
                if (element.src && !element.src.includes('blob:')) {
                    element.src = this.addAntiCacheParam(element.src);
                }
                break;
        }
    }
    addAntiCacheParam(url) {
        if (!url || typeof url !== 'string') return url;
        if (url.startsWith('blob:') || url.startsWith('data:')) {
            return url;
        }
        if (url.includes('ws://') || url.includes('wss://')) {
            return url;
        }
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}_nocache=${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    disableCache() {
        this.antiCacheEnabled = true;
        this.clearBrowserCache();
        this.reloadAllResources();
    }
    enableCache() {
        this.antiCacheEnabled = false;
    }
    clearBrowserCache() {
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                cacheNames.forEach(cacheName => {
                    caches.delete(cacheName);
                });
            }).catch(() => {});
        }
        this.clearImageCache();
    }
    clearImageCache() {
        document.querySelectorAll('img').forEach(img => {
            if (img.src && !img.src.includes('blob:')) {
                const originalSrc = img.src;
                img.src = '';
                setTimeout(() => {
                    img.src = this.addAntiCacheParam(originalSrc);
                }, 10);
            }
        });
    }
    reloadAllResources() {
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.href;
            if (href) {
                link.href = this.addAntiCacheParam(href);
            }
        });
        document.querySelectorAll('script[src]').forEach(script => {
            const src = script.src;
            if (src && !src.includes('blob:')) {
                const newScript = document.createElement('script');
                newScript.src = this.addAntiCacheParam(src);
                newScript.async = script.async;
                newScript.defer = script.defer;
                script.parentNode.replaceChild(newScript, script);
            }
        });
    }
}
window.cacheControlManager = new CacheControlManager();