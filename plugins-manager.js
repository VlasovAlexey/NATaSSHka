const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { translate } = require('./lng-server.js');
const SecureDeleter = require('./secure-delete.js');
class PluginManager {
    constructor(config, io, uploadsDir) {
        this.config = config;
        this.io = io;
        this.uploadsDir = uploadsDir;
        this.plugins = new Map();
        this.pluginsDir = path.join(__dirname, 'plugins');
    }
    async loadPlugins() {
        try {
            if (!fsSync.existsSync(this.pluginsDir)) {
                console.log(translate(this.config.language, 'PLUGINS_DIR_NOT_FOUND'));
                await fs.mkdir(this.pluginsDir, { recursive: true });
                return;
            }
            const pluginDirs = await fs.readdir(this.pluginsDir, { withFileTypes: true });
            for (const dir of pluginDirs) {
                if (!dir.isDirectory()) continue;
                const pluginName = dir.name;
                const pluginPath = path.join(this.pluginsDir, pluginName);
                try {
                    await this.loadPlugin(pluginName, pluginPath);
                } catch (error) {
                    console.error(translate(this.config.language, 'PLUGIN_LOAD_ERROR', { plugin: pluginName }), error);
                }
            }
            console.log(translate(this.config.language, 'PLUGINS_LOADED', { count: this.plugins.size }));
        } catch (error) {
            console.error(translate(this.config.language, 'PLUGINS_LOAD_ERROR_GENERAL'), error);
        }
    }
    async loadPlugin(pluginName, pluginPath) {
        const configFile = path.join(pluginPath, `${pluginName}.json`);
        const scriptFile = path.join(pluginPath, `${pluginName}.js`);
        if (!fsSync.existsSync(configFile) || !fsSync.existsSync(scriptFile)) {
            console.log(translate(this.config.language, 'PLUGIN_FILES_MISSING', { plugin: pluginName }));
            return;
        }
        try {
            const configData = await fs.readFile(configFile, 'utf8');
            const cleanedConfigData = configData.replace(/^\uFEFF/, '');
            const pluginConfig = JSON.parse(cleanedConfigData);
            if (!pluginConfig.enabled) {
                console.log(translate(this.config.language, 'PLUGIN_DISABLED', { plugin: pluginName }));
                return;
            }
            const pluginTranslations = await this.loadPluginTranslations(pluginName, pluginPath);
            const pluginModule = require(scriptFile);
            const pluginInstance = new pluginModule({
                config: pluginConfig,
                mainConfig: this.config,
                io: this.io,
                uploadsDir: this.uploadsDir,
                pluginManager: this,
                translations: pluginTranslations || this.createFallbackTranslations()
            });
            this.plugins.set(pluginName, {
                instance: pluginInstance,
                config: pluginConfig
            });
            await pluginInstance.init?.();
            console.log(translate(this.config.language, 'PLUGIN_LOADED', { plugin: pluginName }));
        } catch (error) {
            console.error(translate(this.config.language, 'PLUGIN_LOAD_ERROR', { plugin: pluginName }), error);
        }
    }
    async loadPluginTranslations(pluginName, pluginPath) {
        const translationsFile = path.join(pluginPath, `${pluginName}-translations.json`);
        if (!fsSync.existsSync(translationsFile)) {
            return null; // У плагина нет своих переводов
        }
        try {
            const translationsData = await fs.readFile(translationsFile, 'utf8');
            const cleanedTranslationsData = translationsData.replace(/^\uFEFF/, '');
            const translations = JSON.parse(cleanedTranslationsData);
            return {
                translations: translations,
                translate: (language, key, params = {}) => {
                    const lang = language || 'ru';
                    let translation = translations[lang] && translations[lang][key]
                        ? translations[lang][key]
                        : translations['ru'] && translations['ru'][key]
                        ? translations['ru'][key]
                        : key;
                    if (typeof translation === 'string') {
                        translation = translation.replace(/\{(\w+)\}/g, (match, placeholder) => {
                            return params[placeholder] !== undefined ? params[placeholder] : match;
                        });
                    }
                    return translation;
                }
            };
        } catch (error) {
            console.error(`[${pluginName}] Error loading translations:`, error);
            return null;
        }
    }
    createFallbackTranslations() {
        return {
            translate: (language, key, params = {}) => {
                const translations = {
                    ru: {},
                    en: {},
                    es: {},
                    zh: {}
                };
                const lang = language || 'ru';
                let translation = translations[lang] && translations[lang][key]
                    ? translations[lang][key]
                    : key;
                if (typeof translation === 'string') {
                    translation = translation.replace(/\{(\w+)\}/g, (match, placeholder) => {
                        return params[placeholder] !== undefined ? params[placeholder] : match;
                    });
                }
                return translation;
            }
        };
    }
    async unloadPlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) return;
        await plugin.instance.destroy?.();
        delete require.cache[require.resolve(path.join(this.pluginsDir, pluginName, `${pluginName}.js`))];
        this.plugins.delete(pluginName);
        console.log(translate(this.config.language, 'PLUGIN_UNLOADED', { plugin: pluginName }));
    }
    async reloadPlugin(pluginName) {
        await this.unloadPlugin(pluginName);
        const pluginPath = path.join(this.pluginsDir, pluginName);
        await this.loadPlugin(pluginName, pluginPath);
    }
    getPlugin(pluginName) {
        return this.plugins.get(pluginName)?.instance;
    }
    async handleMessage(message, socket) {
        for (const [pluginName, plugin] of this.plugins) {
            try {
                const result = await plugin.instance.handleMessage?.(message, socket);
                if (result === true) {
                    return true;
                }
            } catch (error) {
                console.error(translate(this.config.language, 'PLUGIN_HANDLE_ERROR', { plugin: pluginName }), error);
            }
        }
        return false;
    }
    async handleUserJoin(user, socket) {
        for (const [pluginName, plugin] of this.plugins) {
            try {
                await plugin.instance.handleUserJoin?.(user, socket);
            } catch (error) {
                console.error(translate(this.config.language, 'PLUGIN_HANDLE_ERROR', { plugin: pluginName }), error);
            }
        }
    }
    async handleUserLeave(user) {
        for (const [pluginName, plugin] of this.plugins) {
            try {
                await plugin.instance.handleUserLeave?.(user);
            } catch (error) {
                console.error(translate(this.config.language, 'PLUGIN_HANDLE_ERROR', { plugin: pluginName }), error);
            }
        }
    }
    async destroy() {
        for (const [pluginName, plugin] of this.plugins) {
            try {
                await plugin.instance.destroy?.();
            } catch (error) {
                console.error(translate(this.config.language, 'PLUGIN_DESTROY_ERROR', { plugin: pluginName }), error);
            }
        }
        this.plugins.clear();
    }
}
module.exports = PluginManager;