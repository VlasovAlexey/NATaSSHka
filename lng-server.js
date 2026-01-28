const translations = {
    ru: {

        ERROR_WRONG_PASSWORD: 'Неверный пароль',
        ERROR_USERNAME_EXISTS: 'Пользователь с таким именем уже существует в этой комнате',
        SERVER_START: '🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ:',
        PORT_AVAILABLE: '✅ Порт доступен для использования',
        PORT_BUSY: '❌ ОШИБКА: Порт уже занят!',
        PORT_BUSY_SOLUTIONS: '   Возможные решения:\n   1. Измените порт в config.json\n   2. Закройте другое приложение, использующее этот порт\n   3. Подождите несколько секунд и попробуйте снова',


        NEW_CONNECTION: 'Новое подключение:',
        USER_JOINED_ROOM: 'Пользователь вошел в комнату',
        USER_LEFT_ROOM: 'Пользователь вышел из комнаты',


        TURN_SERVERS_ENABLED: 'TURN СЕРВЕРЫ: АКТИВИРОВАНЫ',
        TURN_SERVERS_DISABLED: 'TURN СЕРВЕРЫ: ОТКЛЮЧЕНЫ',
        TURN_WARNING: '⚠️  WebRTC соединения могут не работать через NAT/firewall',
        TURN_NOT_CONFIGURED: 'ℹ️  TURN серверы не настроены в config.json',
        TURN_DISABLED_IN_SETTINGS: 'ℹ️  TURN серверы отключены в настройках (useTurnServers: false)',
        ICE_SERVERS_COUNT: 'Всего ICE серверов:',


        TURN_SERVER_DETAILS: 'TURN сервер',
        TURN_URL: 'URL:',
        TURN_USERNAME: 'Имя пользователя:',
        TURN_PASSWORD: 'Пароль:',
        TURN_MISSING_URL: '❌ ОШИБКА: отсутствует URL TURN сервера',
        TURN_INVALID_PROTOCOL: '❌ ОШИБКА: неверный протокол в URL. Допустимы: turn:, turns:, stun:',
        TURN_MISSING_CREDENTIALS: '❌ ОШИБКА: отсутствуют учетные данные TURN сервера',
        TURN_CREDENTIALS_OK: '✅ Учетные данные присутствуют',
        TURN_PORT: 'Порт:',
        TURN_INVALID_PORT: '❌ ОШИБКА: неверный номер порта',
        TURN_LOW_PORT_WARNING: '⚠️  ВНИМАНИЕ: порт < 1024 может требовать прав администратора',
        TURN_SERVER_COUNT: 'Всего TURN серверов:',


        ERROR_ACCESSING_CAMERA: 'Не удалось получить доступ к камере:',
        ERROR_STARTING_RECORDING: 'Ошибка начала записи:',
        ERROR_FILE_READING: 'Ошибка чтения файла:',
        ERROR_FILE_PROCESSING: 'Ошибка обработки видео',
        ERROR_FILE_UPLOAD: 'Ошибка загрузки видео',
        ERROR_RECORDING: 'Не удалось записать видео',
        ERROR_SERVER_CONNECTION: 'Нет соединения с сервером',
        ERROR_SOCKET_CONNECTION: 'Нет соединения с сервером. Подождите подключения...',
        ERROR_SENDING_VIDEO: 'Ошибка отправки видео:',
        ERROR_SENDING_FILE: 'Ошибка отправки файла:',
        ERROR_SAVING_FILE: 'Ошибка сохранения файла',
        ERROR_SAVING_AUDIO_FILE: 'Ошибка сохранения аудиофайла',
        ERROR_SAVING: 'Ошибка сохранения',


        MAX_FILE_SIZE: '📁 Максимальный размер файла:',
        FILE_STORAGE_PATH: '💾 Сообщения и файлы сохраняются в:',
        TURN_STATUS: '🔧 Использование TURN серверов:',
        TURN_ENABLED: 'ВКЛЮЧЕНО',
        TURN_DISABLED: 'ОТКЛЮЧЕНО',
        MB: 'МБ',
        KB: 'КБ',
        BYTES: 'байт',


        CHAT_HISTORY_CLEARED: 'История чата была очищена',
        HISTORY_CLEARED_BY_USER: 'История чата была очищена пользователем {username}',
        USER_JOINED: 'Пользователь {username} присоединился к комнате',
        USER_LEFT: 'Пользователь {username} вышел из комнаты',
        DOUBLE_LOGIN_WARNING: 'Внимание! Попытка входа {username} под уже вошедшим пользователем с другого устройства!',
        KILLALL_MESSAGE: 'Все файлы пользователей на сервере удалены. Сервер выключен. Требуется ручной запуск чистого сервера!',
        FILES_TOO_BIG: 'Файл слишком большой. Максимальный размер:',
        FAILED_TO_SEND_FILE: 'Не удалось отправить файл',
        SYSTEM: 'Система',


        MESSAGE_DELETION_REQUESTED: 'запросил удаление сообщения',
        MESSAGE_NOT_FOUND: 'Сообщение не найдено',
        MESSAGE_SUCCESSFULLY_DELETED: 'успешно удалил сообщение',
        CANNOT_DELETE_OTHERS_MESSAGES: 'Нельзя удалять чужие сообщения',
        ATTEMPTS_TO_DELETE_MESSAGE_OF: 'пытается удалить сообщение',
        FILE_DELETION_ERROR: 'Не удалось удалить файлы сообщения',
        CONFIRM_DELETION: 'Подтверждение удаления',
        DELETE_CONFIRMATION_TEXT: 'Вы действительно хотите безвозвратно удалить это сообщение?',
        IN_ROOM: 'в комнате',
        FOR_USER: 'для пользователя',
        STARTING_FILE_DELETION: 'Начинаем удаление файлов сообщения',
        OF_USER: 'пользователя',
        FOUND_FILEURLS_IN_XML: 'Найдено fileUrls в XML',
        XML_MESSAGE_NOT_FOUND: 'XML файл сообщения не найден',
        ERROR_DELETING_FILE: 'Ошибка удаления файла',
        ERROR_DELETING_RELATED_FILE: 'Ошибка удаления связанного файла',
        FILE_DELETION_COMPLETED: 'Завершено удаление файлов сообщения',
        GENERAL_FILE_DELETION_ERROR: 'Общая ошибка удаления файлов сообщения',


        REACTION_ADDED: 'добавил реакцию',
        REACTION_ALREADY_ADDED: 'уже ставил реакцию для сообщения',
        TO_MESSAGE: 'к сообщению',
        FOR_MESSAGE: 'для сообщения',
        ERROR_UPDATING_REACTIONS_IN_FILE: 'Ошибка обновления реакций в файле',


        CAMERA_ACCESS_REQUEST: 'Запрос доступа к камере...',
        CAMERA_ACCESS_GRANTED: 'Доступ к камере получен',
        VIDEO_UPLOAD_PREPARATION: 'Подготовка видео к отправке',
        VIDEO_DATA_SIZE: 'Размер видео данных:',
        VIDEO_ENCRYPTION_START: 'Шифрование видео перед отправкой',
        VIDEO_SUCCESSFULLY_ENCRYPTED: 'Видео успешно зашифровано',
        VIDEO_NO_ENCRYPTION_KEY: 'Ключ шифрования не установлен, видео отправляется без шифрования',
        VIDEO_SENDING_TO_SERVER: 'Отправка видео на сервер',
        VIDEO_SUCCESSFULLY_SENT: 'Видео успешно отправлено',
        AUDIO_MESSAGE_RECEIVED_FROM_USER: 'Получено аудиосообщение от пользователя',
        AUDIO_DATA_SIZE: 'Размер аудиоданных',
        AUDIO_FILE_SAVED: 'Аудиофайл сохранен',
        AUDIO_MESSAGE_SAVED: 'Сообщение о аудиофайле сохранено',
        AUDIO_MESSAGE_SENT_TO_ROOM: 'Аудиосообщение отправлено в комнату',


        XML_READ_ERROR: 'Ошибка чтения XML файла сообщения:',
        XML_CHECK_ERROR: 'Ошибка при проверке сообщения',


        SERVER_SHUTDOWN: 'Сервер завершает работу по команде killall',
        UPLOADS_FOLDER_DELETED: 'Удалена папка uploads со всем содержимым',
        ROOM_FOLDER_DELETED: 'Удалена папка комнаты по команде kill',
        ACTIVATED_KILLALL_COMMAND: 'активировал killall команду',
        CLEARED_CHAT_AND_FILES: 'очистил чат комнаты и удалил файлы',
        REASON: 'Причина',
        CALL_REJECTED: 'Звонок отклонен',


        MESSAGE_SAVED: 'Сообщение сохранено:',
        SYSTEM_MESSAGE_SAVED: 'Системное сообщение сохранено:',
        FILE_METADATA_SAVED: 'Метаданные файла сохранены:',
        FILE_SAVED: 'Файл сохранен:',
        FILE_DELETED: 'Удален файл:',
        RELATED_FILE_DELETED: 'Удален связанный файл:',
        XML_MESSAGE_DELETED: 'Удален XML файл сообщения:',
        REACTIONS_UPDATED: 'Реакции обновлены в файле:',
        MESSAGE_SAVED_TO_FILE: 'Сообщение сохранено в файл:',
        FILE_MESSAGE_SAVED: 'Сообщение о файле сохранено:',


        MESSAGE_LOAD_ERROR: 'Ошибка загрузки сообщений комнаты:',
        SINGLE_MESSAGE_LOAD_ERROR: 'Ошибка чтения файла сообщения:',
        MESSAGE_SAVE_ERROR: 'Ошибка сохранения сообщения в файл:',
        SYSTEM_MESSAGE_SAVE_ERROR: 'Ошибка сохранения системного сообщения в файл:',
        FILE_METADATA_SAVE_ERROR: 'Ошибка сохранения метаданных файла:',


        UNKNOWN_USER: 'неизвестного пользователя',
        USER_DIR_NOT_FOUND: 'Директория пользователя не найдена:',


        STORAGE_TYPE_DETECTED: 'Тип накопителя определен как: {type}',
        STORAGE_DETECTION_ERROR: 'Ошибка определения типа накопителя',
        SECURE_DELETE_DISABLED: 'Безопасное удаление отключено в конфигурации',
        SECURE_DELETE_START: 'Начало безопасного удаления файла: {path} ({size})',
        SECURE_DELETE_COMPLETE: 'Безопасное удаление завершено: {path} (заняло {time} сек)',
        SECURE_DELETE_ERROR: 'Ошибка безопасного удаления файла',
        FILE_DELETE_FAILED: 'Не удалось удалить файл {file} по пути {path}. Ошибка: {error}',


        SSD_OPTIMIZED_DELETE: 'Оптимизированное удаление для SSD',
        HDD_FULL_DELETE: 'Полное удаление для HDD/магнитного носителя',
        SSD_DELETE_ERROR: 'Ошибка удаления на SSD',
        HDD_DELETE_ERROR: 'Ошибка удаления на HDD',


        GOST_OVERWRITE_START: 'Перезапись по ГОСТ Р 50739-9 ({passes} прохода)',
        GOST_OVERWRITE_COMPLETE: 'Перезапись по ГОСТ завершена',
        GOST_OVERWRITE_ERROR: 'Ошибка перезаписи по ГОСТ',
        GOST_PASS_1_START: 'ГОСТ проход 1: случайные данные',
        GOST_PASS_1_COMPLETE: 'ГОСТ проход 1 завершен',
        GOST_PASS_2_START: 'ГОСТ проход 2: фиксированный шаблон',
        GOST_PASS_2_COMPLETE: 'ГОСТ проход 2 завершен',


        VERIFICATION_FAILED: 'Верификация удаления не пройдена',
        VERIFICATION_FAILED_SIZE: 'Верификация не пройдена: файл {path} имеет размер {size} байт',
        VERIFICATION_ERROR: 'Ошибка верификации удаления',


        METADATA_CHANGE_ERROR: 'Ошибка изменения метаданных файла',


        SYMLINK_DETECTED: 'Обнаружен симлинк: {path}',
        SYMLINK_TARGET: 'Цель симлинка: {target}',
        SYMLINK_DELETE_ERROR: 'Ошибка удаления симлинка',


        ROOM_DIR_NOT_FOUND: 'Директория комнаты не найдена: {room}',
        UPLOADS_DIR_NOT_FOUND: 'Директория uploads не найдена',
        ROOM_DELETION_START: 'Начало безопасного удаления комнаты: {room}',
        ROOM_DELETION_COMPLETE: 'Безопасное удаление комнаты завершено: {room}',
        ROOM_DELETION_ERROR: 'Ошибка удаления комнаты: {room}',
        UPLOADS_DELETION_START: 'Начало безопасного удаления директории uploads',
        UPLOADS_DELETION_COMPLETE: 'Безопасное удаление директории uploads завершено',
        UPLOADS_DELETION_ERROR: 'Ошибка удаления директории uploads',
        DIR_FILE_DELETE_ERROR: 'Ошибка удаления файла в директории: {file}',
        DIR_DELETION_ERROR: 'Ошибка удаления директории: {dir}',


        CORS_ENABLED: '🌐 CORS включен с настройками: origin={origin}',
        CORS_DISABLED: '🌐 CORS отключен',


        HTTPS_ENABLED: '🔐 HTTPS сервер запущен на порту: {port}',
        HTTPS_ERROR: '❌ Ошибка запуска HTTPS сервера:',
        FALLBACK_TO_HTTP: '🔄 Возврат к HTTP серверу',
        HTTP_REDIRECT_ENABLED: '🔀 HTTP перенаправление с порта {from} на HTTPS порт {to}',


        CONNECTION_ERROR: '❌ Ошибка подключения к серверу',
        INVALID_HTTPS_CERTIFICATE: '❌ Недействительный HTTPS сертификат',
        SSL_CERTIFICATE_EXPIRED: '❌ SSL сертификат истек',
        SSL_CERTIFICATE_NOT_YET_VALID: '❌ SSL сертификат еще не действителен',


        SERVER_START: '🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ:',
        PORT_AVAILABLE: '✅ Порт доступен для использования',
        PORT_BUSY: '❌ ПОРТ ЗАНЯТ:',
        PORT_BUSY_SOLUTIONS: '🔧 Решения: 1) Закройте другое приложение на этом порту 2) Измените порт в config.json 3) Перезапустите сервер',


        TURN_SERVERS_ENABLED: '🔄 TURN СЕРВЕРЫ ВКЛЮЧЕНЫ',
        TURN_SERVERS_DISABLED: '🔴 TURN СЕРВЕРЫ ОТКЛЮЧЕНЫ',
        TURN_WARNING: '⚠️ ВНИМАНИЕ: TURN серверы отключены. WebRTC может не работать за NAT',
        TURN_SERVER_COUNT: '📊 Всего TURN серверов:',


        MAX_FILE_SIZE: '📁 Максимальный размер файла:',
        MB: 'МБ',
        FILE_STORAGE_PATH: '📂 Путь хранения файлов:',


        TURN_STATUS: '🌐 Статус TURN:',
        TURN_ENABLED: 'ВКЛЮЧЕН',
        TURN_DISABLED: 'ОТКЛЮЧЕН',
        ICE_SERVERS_COUNT: '🧊 Всего ICE серверов:',

        REDIRECT_PORT_BUSY: '❌ Порт редиректа занят: {port}',
        REDIRECT_LOG: '🔄 Редирект: {ip} → {from} → {to}',
        REDIRECT_DISABLED: 'ℹ️ HTTP редирект отключен из-за занятого порта',

        HTTPS_SERVER_STARTED: '🔐 HTTPS сервер запущен на порту:',
        SSL_CERTIFICATES: '🔐 SSL сертификаты:',
        SSL_KEY: '   Ключ:',
        SSL_CERT: '   Сертификат:',
        SSL_CA: '   CA:'
    },

    en: {
        ERROR_WRONG_PASSWORD: 'Wrong password',
        ERROR_USERNAME_EXISTS: 'User with this name already exists in this room',
        SERVER_START: '🚀 SERVER STARTED ON PORT:',
        PORT_AVAILABLE: '✅ Port is available for use',
        PORT_BUSY: '❌ ERROR: Port is already in use!',
        PORT_BUSY_SOLUTIONS: '   Possible solutions:\n   1. Change port in config.json\n   2. Close another application using this port\n   3. Wait a few seconds and try again',

        NEW_CONNECTION: 'New connection:',
        USER_JOINED_ROOM: 'User entered room',
        USER_LEFT_ROOM: 'User left room',

        TURN_SERVERS_ENABLED: 'TURN SERVERS: ENABLED',
        TURN_SERVERS_DISABLED: 'TURN SERVERS: DISABLED',
        TURN_WARNING: '⚠️  WebRTC connections may not work through NAT/firewall',
        TURN_NOT_CONFIGURED: 'ℹ️  TURN servers not configured in config.json',
        TURN_DISABLED_IN_SETTINGS: 'ℹ️  TURN servers disabled in settings (useTurnServers: false)',
        ICE_SERVERS_COUNT: 'Total ICE servers:',

        TURN_SERVER_DETAILS: 'TURN server',
        TURN_URL: 'URL:',
        TURN_USERNAME: 'Username:',
        TURN_PASSWORD: 'Password:',
        TURN_MISSING_URL: '❌ ERROR: TURN server URL missing',
        TURN_INVALID_PROTOCOL: '❌ ERROR: Invalid protocol in URL. Allowed: turn:, turns:, stun:',
        TURN_MISSING_CREDENTIALS: '❌ ERROR: Missing TURN server credentials',
        TURN_CREDENTIALS_OK: '✅ Credentials present',
        TURN_PORT: 'Port:',
        TURN_INVALID_PORT: '❌ ERROR: Invalid port number',
        TURN_LOW_PORT_WARNING: '⚠️  WARNING: Port < 1024 may require administrator rights',
        TURN_SERVER_COUNT: 'Total TURN servers:',

        ERROR_ACCESSING_CAMERA: 'Failed to access camera:',
        ERROR_STARTING_RECORDING: 'Error starting recording:',
        ERROR_FILE_READING: 'Error reading file:',
        ERROR_FILE_PROCESSING: 'Error processing video',
        ERROR_FILE_UPLOAD: 'Video upload error',
        ERROR_RECORDING: 'Failed to record video',
        ERROR_SERVER_CONNECTION: 'No server connection',
        ERROR_SOCKET_CONNECTION: 'No server connection. Wait for connection...',
        ERROR_SENDING_VIDEO: 'Error sending video:',
        ERROR_SENDING_FILE: 'Error sending file:',
        ERROR_SAVING_FILE: 'Error saving file',
        ERROR_SAVING_AUDIO_FILE: 'Error saving audio file',
        ERROR_SAVING: 'Error saving',

        MAX_FILE_SIZE: '📁 Maximum file size:',
        FILE_STORAGE_PATH: '💾 Messages and files are stored in:',
        TURN_STATUS: '🔧 TURN servers usage:',
        TURN_ENABLED: 'ENABLED',
        TURN_DISABLED: 'DISABLED',
        MB: 'MB',
        KB: 'KB',
        BYTES: 'bytes',

        CHAT_HISTORY_CLEARED: 'Chat history has been cleared',
        HISTORY_CLEARED_BY_USER: 'Chat history cleared by user {username}',
        USER_JOINED: 'User {username} joined the room',
        USER_LEFT: 'User {username} left the room',
        DOUBLE_LOGIN_WARNING: 'Warning! Attempt to login {username} as already logged in user from another device!',
        KILLALL_MESSAGE: 'All user files on the server have been deleted. Server is shut down. Manual restart of clean server required!',
        FILES_TOO_BIG: 'File is too large. Maximum size:',
        FAILED_TO_SEND_FILE: 'Failed to send file',
        SYSTEM: 'System',

        MESSAGE_DELETION_REQUESTED: 'requested deletion of message',
        MESSAGE_NOT_FOUND: 'Message not found',
        MESSAGE_SUCCESSFULLY_DELETED: 'successfully deleted message',
        CANNOT_DELETE_OTHERS_MESSAGES: 'Cannot delete other users messages',
        ATTEMPTS_TO_DELETE_MESSAGE_OF: 'attempts to delete message of',
        FILE_DELETION_ERROR: 'Failed to delete message files',
        CONFIRM_DELETION: 'Delete confirmation',
        DELETE_CONFIRMATION_TEXT: 'Do you really want to permanently delete this message?',
        IN_ROOM: 'in room',
        FOR_USER: 'for user',
        STARTING_FILE_DELETION: 'Starting deletion of message files',
        OF_USER: 'of user',
        FOUND_FILEURLS_IN_XML: 'Found fileUrls in XML',
        XML_MESSAGE_NOT_FOUND: 'XML message file not found',
        ERROR_DELETING_FILE: 'Error deleting file',
        ERROR_DELETING_RELATED_FILE: 'Error deleting related file',
        FILE_DELETION_COMPLETED: 'File deletion completed',
        GENERAL_FILE_DELETION_ERROR: 'General file deletion error',

        REACTION_ADDED: 'added reaction',
        REACTION_ALREADY_ADDED: 'already added reaction for message',
        TO_MESSAGE: 'to message',
        FOR_MESSAGE: 'for message',
        ERROR_UPDATING_REACTIONS_IN_FILE: 'Error updating reactions in file',

        CAMERA_ACCESS_REQUEST: 'Requesting camera access...',
        CAMERA_ACCESS_GRANTED: 'Camera access granted',
        VIDEO_UPLOAD_PREPARATION: 'Preparing video for upload',
        VIDEO_DATA_SIZE: 'Video data size:',
        VIDEO_ENCRYPTION_START: 'Encrypting video before sending',
        VIDEO_SUCCESSFULLY_ENCRYPTED: 'Video successfully encrypted',
        VIDEO_NO_ENCRYPTION_KEY: 'Encryption key not set, video sent without encryption',
        VIDEO_SENDING_TO_SERVER: 'Sending video to server',
        VIDEO_SUCCESSFULLY_SENT: 'Video successfully sent',
        AUDIO_MESSAGE_RECEIVED_FROM_USER: 'Audio message received from user',
        AUDIO_DATA_SIZE: 'Audio data size',
        AUDIO_FILE_SAVED: 'Audio file saved',
        AUDIO_MESSAGE_SAVED: 'Audio message saved',
        AUDIO_MESSAGE_SENT_TO_ROOM: 'Audio message sent to room',

        XML_READ_ERROR: 'Error reading XML message file:',
        XML_CHECK_ERROR: 'Error checking message',

        SERVER_SHUTDOWN: 'Server shutting down by killall command',
        UPLOADS_FOLDER_DELETED: 'Uploads folder deleted with all contents',
        ROOM_FOLDER_DELETED: 'Room folder deleted by kill command',
        ACTIVATED_KILLALL_COMMAND: 'activated killall command',
        CLEARED_CHAT_AND_FILES: 'cleared chat room and deleted files',
        REASON: 'Reason',
        CALL_REJECTED: 'Call rejected',

        MESSAGE_SAVED: 'Message saved:',
        SYSTEM_MESSAGE_SAVED: 'System message saved:',
        FILE_METADATA_SAVED: 'File metadata saved:',
        FILE_SAVED: 'File saved:',
        FILE_DELETED: 'File deleted:',
        RELATED_FILE_DELETED: 'Related file deleted:',
        XML_MESSAGE_DELETED: 'XML message file deleted:',
        REACTIONS_UPDATED: 'Reactions updated in file:',
        MESSAGE_SAVED_TO_FILE: 'Message saved to file:',
        FILE_MESSAGE_SAVED: 'File message saved:',

        MESSAGE_LOAD_ERROR: 'Error loading room messages:',
        SINGLE_MESSAGE_LOAD_ERROR: 'Error reading message file:',
        MESSAGE_SAVE_ERROR: 'Error saving message to file:',
        SYSTEM_MESSAGE_SAVE_ERROR: 'Error saving system message to file:',
        FILE_METADATA_SAVE_ERROR: 'Error saving file metadata:',

        UNKNOWN_USER: 'unknown user',
        USER_DIR_NOT_FOUND: 'User directory not found:',

        STORAGE_TYPE_DETECTED: 'Storage type detected as: {type}',
        STORAGE_DETECTION_ERROR: 'Storage type detection error',
        SECURE_DELETE_DISABLED: 'Secure delete disabled in configuration',
        SECURE_DELETE_START: 'Starting secure deletion of file: {path} ({size})',
        SECURE_DELETE_COMPLETE: 'Secure deletion complete: {path} (took {time} sec)',
        SECURE_DELETE_ERROR: 'Secure file deletion error',
        FILE_DELETE_FAILED: 'Failed to delete file {file} at path {path}. Error: {error}',

        SSD_OPTIMIZED_DELETE: 'Optimized deletion for SSD',
        HDD_FULL_DELETE: 'Full deletion for HDD/magnetic storage',
        SSD_DELETE_ERROR: 'SSD deletion error',
        HDD_DELETE_ERROR: 'HDD deletion error',

        GOST_OVERWRITE_START: 'GOST Р 50739-9 overwrite ({passes} passes)',
        GOST_OVERWRITE_COMPLETE: 'GOST overwrite complete',
        GOST_OVERWRITE_ERROR: 'GOST overwrite error',
        GOST_PASS_1_START: 'GOST pass 1: random data',
        GOST_PASS_1_COMPLETE: 'GOST pass 1 complete',
        GOST_PASS_2_START: 'GOST pass 2: fixed pattern',
        GOST_PASS_2_COMPLETE: 'GOST pass 2 complete',

        VERIFICATION_FAILED: 'Deletion verification failed',
        VERIFICATION_FAILED_SIZE: 'Verification failed: file {path} has size {size} bytes',
        VERIFICATION_ERROR: 'Deletion verification error',

        METADATA_CHANGE_ERROR: 'File metadata change error',

        SYMLINK_DETECTED: 'Symlink detected: {path}',
        SYMLINK_TARGET: 'Symlink target: {target}',
        SYMLINK_DELETE_ERROR: 'Symlink deletion error',

        ROOM_DIR_NOT_FOUND: 'Room directory not found: {room}',
        UPLOADS_DIR_NOT_FOUND: 'Uploads directory not found',
        ROOM_DELETION_START: 'Starting secure deletion of room: {room}',
        ROOM_DELETION_COMPLETE: 'Secure room deletion complete: {room}',
        ROOM_DELETION_ERROR: 'Room deletion error: {room}',
        UPLOADS_DELETION_START: 'Starting secure deletion of uploads directory',
        UPLOADS_DELETION_COMPLETE: 'Secure uploads directory deletion complete',
        UPLOADS_DELETION_ERROR: 'Uploads directory deletion error',
        DIR_FILE_DELETE_ERROR: 'Directory file deletion error: {file}',
        DIR_DELETION_ERROR: 'Directory deletion error: {dir}',


        CORS_ENABLED: '🌐 CORS enabled with settings: origin={origin}',
        CORS_DISABLED: '🌐 CORS disabled',


        HTTPS_ENABLED: '🔐 HTTPS server started on port: {port}',
        HTTPS_ERROR: '❌ HTTPS server startup error:',
        FALLBACK_TO_HTTP: '🔄 Falling back to HTTP server',
        HTTP_REDIRECT_ENABLED: '🔀 HTTP redirect from port {from} to HTTPS port {to}',


        CONNECTION_ERROR: '❌ Connection error to server',
        INVALID_HTTPS_CERTIFICATE: '❌ Invalid HTTPS certificate',
        SSL_CERTIFICATE_EXPIRED: '❌ SSL certificate expired',
        SSL_CERTIFICATE_NOT_YET_VALID: '❌ SSL certificate not yet valid',


        SERVER_START: '🚀 SERVER STARTED ON PORT:',
        PORT_AVAILABLE: '✅ Port available for use',
        PORT_BUSY: '❌ PORT BUSY:',
        PORT_BUSY_SOLUTIONS: '🔧 Solutions: 1) Close another application on this port 2) Change port in config.json 3) Restart server',


        TURN_SERVERS_ENABLED: '🔄 TURN SERVERS ENABLED',
        TURN_SERVERS_DISABLED: '🔴 TURN SERVERS DISABLED',
        TURN_WARNING: '⚠️ WARNING: TURN servers are disabled. WebRTC may not work behind NAT',
        TURN_SERVER_COUNT: '📊 Total TURN servers:',


        MAX_FILE_SIZE: '📁 Maximum file size:',
        MB: 'MB',
        FILE_STORAGE_PATH: '📂 File storage path:',


        TURN_STATUS: '🌐 TURN status:',
        TURN_ENABLED: 'ENABLED',
        TURN_DISABLED: 'DISABLED',
        ICE_SERVERS_COUNT: '🧊 Total ICE servers:',

        REDIRECT_PORT_BUSY: '❌ Redirect port busy: {port}',
        REDIRECT_LOG: '🔄 Redirect: {ip} → {from} → {to}',
        REDIRECT_DISABLED: 'ℹ️ HTTP redirect disabled due to busy port',

        HTTPS_SERVER_STARTED: '🔐 HTTPS server started on port:',
        SSL_CERTIFICATES: '🔐 SSL certificates:',
        SSL_KEY: '   Key:',
        SSL_CERT: '   Certificate:',
        SSL_CA: '   CA:'
    },

    es: {
        ERROR_WRONG_PASSWORD: 'Contraseña incorrecta',
        ERROR_USERNAME_EXISTS: 'Ya existe un usuario con este nombre en esta sala',
        SERVER_START: '🚀 SERVIDOR INICIADO EN EL PUERTO:',
        PORT_AVAILABLE: '✅ Puerto disponible para uso',
        PORT_BUSY: '❌ ERROR: ¡El puerto ya está en uso!',
        PORT_BUSY_SOLUTIONS: '   Soluciones posibles:\n   1. Cambie el puerto en config.json\n   2. Cierre otra aplicación que use este puerto\n   3. Espere unos segundos e intente de nuevo',

        NEW_CONNECTION: 'Nueva conexión:',
        USER_JOINED_ROOM: 'Usuario entró a la sala',
        USER_LEFT_ROOM: 'Usuario salió de la sala',

        TURN_SERVERS_ENABLED: 'SERVIDORES TURN: HABILITADOS',
        TURN_SERVERS_DISABLED: 'SERVIDORES TURN: DESHABILITADOS',
        TURN_WARNING: '⚠️  Las conexiones WebRTC pueden no funcionar a través de NAT/firewall',
        TURN_NOT_CONFIGURED: 'ℹ️  Servidores TURN no configurados en config.json',
        TURN_DISABLED_IN_SETTINGS: 'ℹ️  Servidores TURN deshabilitados en configuraciones (useTurnServers: false)',
        ICE_SERVERS_COUNT: 'Total de servidores ICE:',

        TURN_SERVER_DETAILS: 'Servidor TURN',
        TURN_URL: 'URL:',
        TURN_USERNAME: 'Nombre de usuario:',
        TURN_PASSWORD: 'Contraseña:',
        TURN_MISSING_URL: '❌ ERROR: Falta URL del servidor TURN',
        TURN_INVALID_PROTOCOL: '❌ ERROR: Protocolo inválido en URL. Permitidos: turn:, turns:, stun:',
        TURN_MISSING_CREDENTIALS: '❌ ERROR: Faltan credenciales del servidor TURN',
        TURN_CREDENTIALS_OK: '✅ Credenciales presentes',
        TURN_PORT: 'Puerto:',
        TURN_INVALID_PORT: '❌ ERROR: Número de puerto inválido',
        TURN_LOW_PORT_WARNING: '⚠️  ADVERTENCIA: Puerto < 1024 puede requerir derechos de administrador',
        TURN_SERVER_COUNT: 'Total de servidores TURN:',

        ERROR_ACCESSING_CAMERA: 'No se pudo acceder a la cámara:',
        ERROR_STARTING_RECORDING: 'Error al iniciar grabación:',
        ERROR_FILE_READING: 'Error leyendo archivo:',
        ERROR_FILE_PROCESSING: 'Error procesando video',
        ERROR_FILE_UPLOAD: 'Error subiendo video',
        ERROR_RECORDING: 'No se pudo grabar video',
        ERROR_SERVER_CONNECTION: 'Sin conexión al servidor',
        ERROR_SOCKET_CONNECTION: 'Sin conexión al servidor. Espere conexión...',
        ERROR_SENDING_VIDEO: 'Error enviando video:',
        ERROR_SENDING_FILE: 'Error enviando archivo:',
        ERROR_SAVING_FILE: 'Error guardando archivo',
        ERROR_SAVING_AUDIO_FILE: 'Error guardando archivo de audio',
        ERROR_SAVING: 'Error guardando',

        MAX_FILE_SIZE: '📁 Tamaño máximo de archivo:',
        FILE_STORAGE_PATH: '💾 Mensajes y archivos se almacenan en:',
        TURN_STATUS: '🔧 Uso de servidores TURN:',
        TURN_ENABLED: 'HABILITADO',
        TURN_DISABLED: 'DESHABILITADO',
        MB: 'MB',
        KB: 'KB',
        BYTES: 'bytes',

        CHAT_HISTORY_CLEARED: 'Historial del chat ha sido borrado',
        HISTORY_CLEARED_BY_USER: 'Historial del chat borrado por usuario {username}',
        USER_JOINED: 'Usuario {username} se unió a la sala',
        USER_LEFT: 'Usuario {username} salió de la sala',
        DOUBLE_LOGIN_WARNING: '¡Advertencia! ¡Intento de inicio de sesión {username} como usuario ya conectado desde otro dispositivo!',
        KILLALL_MESSAGE: '¡Todos los archivos de usuario en el servidor han sido eliminados. Servidor apagado. ¡Se requiere reinicio manual del servidor limpio!',
        FILES_TOO_BIG: 'Archivo demasiado grande. Tamaño máximo:',
        FAILED_TO_SEND_FILE: 'No se pudo enviar archivo',
        SYSTEM: 'Sistema',

        MESSAGE_DELETION_REQUESTED: 'solicitó eliminación de mensaje',
        MESSAGE_NOT_FOUND: 'Mensaje no encontrado',
        MESSAGE_SUCCESSFULLY_DELETED: 'eliminó exitosamente el mensaje',
        CANNOT_DELETE_OTHERS_MESSAGES: 'No se pueden eliminar mensajes de otros usuarios',
        ATTEMPTS_TO_DELETE_MESSAGE_OF: 'intenta eliminar mensaje de',
        FILE_DELETION_ERROR: 'No se pudieron eliminar archivos del mensaje',
        CONFIRM_DELETION: 'Confirmación de eliminación',
        DELETE_CONFIRMATION_TEXT: '¿Realmente desea eliminar permanentemente este mensaje?',
        IN_ROOM: 'en sala',
        FOR_USER: 'para usuario',
        STARTING_FILE_DELETION: 'Iniciando eliminación de archivos de mensaje',
        OF_USER: 'de usuario',
        FOUND_FILEURLS_IN_XML: 'Encontrados fileUrls en XML',
        XML_MESSAGE_NOT_FOUND: 'Archivo XML de mensaje no encontrado',
        ERROR_DELETING_FILE: 'Error eliminando archivo',
        ERROR_DELETING_RELATED_FILE: 'Error eliminando archivo relacionado',
        FILE_DELETION_COMPLETED: 'Eliminación de archivos completada',
        GENERAL_FILE_DELETION_ERROR: 'Error general eliminando archivos',

        REACTION_ADDED: 'agregó reacción',
        REACTION_ALREADY_ADDED: 'ya agregó reacción para el mensaje',
        TO_MESSAGE: 'al mensaje',
        FOR_MESSAGE: 'para mensaje',
        ERROR_UPDATING_REACTIONS_IN_FILE: 'Error actualizando reacciones en archivo',

        CAMERA_ACCESS_REQUEST: 'Solicitando acceso a cámara...',
        CAMERA_ACCESS_GRANTED: 'Acceso a cámara concedido',
        VIDEO_UPLOAD_PREPARATION: 'Preparando video para subir',
        VIDEO_DATA_SIZE: 'Tamaño de datos de video:',
        VIDEO_ENCRYPTION_START: 'Encriptando video antes de enviar',
        VIDEO_SUCCESSFULLY_ENCRYPTED: 'Video encriptado exitosamente',
        VIDEO_NO_ENCRYPTION_KEY: 'Clave de encriptación no establecida, video enviado sin encriptación',
        VIDEO_SENDING_TO_SERVER: 'Enviando video al servidor',
        VIDEO_SUCCESSFULLY_SENT: 'Video enviado exitosamente',
        AUDIO_MESSAGE_RECEIVED_FROM_USER: 'Mensaje de audio recibido de usuario',
        AUDIO_DATA_SIZE: 'Tamaño de datos de audio',
        AUDIO_FILE_SAVED: 'Archivo de audio guardado',
        AUDIO_MESSAGE_SAVED: 'Mensaje de audio guardado',
        AUDIO_MESSAGE_SENT_TO_ROOM: 'Mensaje de audio enviado a sala',

        XML_READ_ERROR: 'Error leyendo archivo XML de mensaje:',
        XML_CHECK_ERROR: 'Error verificando mensaje',

        SERVER_SHUTDOWN: 'Servidor apagándose por comando killall',
        UPLOADS_FOLDER_DELETED: 'Carpeta uploads eliminada con todo su contenido',
        ROOM_FOLDER_DELETED: 'Carpeta de sala eliminada por comando kill',
        ACTIVATED_KILLALL_COMMAND: 'activó comando killall',
        CLEARED_CHAT_AND_FILES: 'limpió chat de sala y eliminó archivos',
        REASON: 'Razón',
        CALL_REJECTED: 'Llamada rechazada',

        MESSAGE_SAVED: 'Mensaje guardado:',
        SYSTEM_MESSAGE_SAVED: 'Mensaje del sistema guardado:',
        FILE_METADATA_SAVED: 'Metadatos de archivo guardados:',
        FILE_SAVED: 'Archivo guardado:',
        FILE_DELETED: 'Archivo eliminado:',
        RELATED_FILE_DELETED: 'Archivo relacionado eliminado:',
        XML_MESSAGE_DELETED: 'Archivo XML de mensaje eliminado:',
        REACTIONS_UPDATED: 'Reacciones actualizadas en archivo:',
        MESSAGE_SAVED_TO_FILE: 'Mensaje guardado en archivo:',
        FILE_MESSAGE_SAVED: 'Mensaje de archivo guardado:',

        MESSAGE_LOAD_ERROR: 'Error cargando mensajes de sala:',
        SINGLE_MESSAGE_LOAD_ERROR: 'Error leyendo archivo de mensaje:',
        MESSAGE_SAVE_ERROR: 'Error guardando mensaje en archivo:',
        SYSTEM_MESSAGE_SAVE_ERROR: 'Error guardando mensaje del sistema en archivo:',
        FILE_METADATA_SAVE_ERROR: 'Error guardando metadatos de archivo:',

        UNKNOWN_USER: 'usuario desconocido',
        USER_DIR_NOT_FOUND: 'Directorio de usuario no encontrado:',

        STORAGE_TYPE_DETECTED: 'Tipo de almacenamiento detectado como: {type}',
        STORAGE_DETECTION_ERROR: 'Error de detección de tipo de almacenamiento',
        SECURE_DELETE_DISABLED: 'Eliminación segura deshabilitada en configuración',
        SECURE_DELETE_START: 'Iniciando eliminación segura de archivo: {path} ({size})',
        SECURE_DELETE_COMPLETE: 'Eliminación segura completada: {path} (tomó {time} seg)',
        SECURE_DELETE_ERROR: 'Error de eliminación segura de archivo',
        FILE_DELETE_FAILED: 'No se pudo eliminar archivo {file} en ruta {path}. Error: {error}',

        SSD_OPTIMIZED_DELETE: 'Eliminación optimizada para SSD',
        HDD_FULL_DELETE: 'Eliminación completa para HDD/almacenamiento magnético',
        SSD_DELETE_ERROR: 'Error de eliminación SSD',
        HDD_DELETE_ERROR: 'Error de eliminación HDD',

        GOST_OVERWRITE_START: 'Sobreescritura GOST Р 50739-9 ({passes} pasadas)',
        GOST_OVERWRITE_COMPLETE: 'Sobreescritura GOST completada',
        GOST_OVERWRITE_ERROR: 'Error de sobreescritura GOST',
        GOST_PASS_1_START: 'GOST pasada 1: datos aleatorios',
        GOST_PASS_1_COMPLETE: 'GOST pasada 1 completada',
        GOST_PASS_2_START: 'GOST pasada 2: patrón fijo',
        GOST_PASS_2_COMPLETE: 'GOST pasada 2 completada',

        VERIFICATION_FAILED: 'Verificación de eliminación falló',
        VERIFICATION_FAILED_SIZE: 'Verificación falló: archivo {path} tiene tamaño {size} bytes',
        VERIFICATION_ERROR: 'Error de verificación de eliminación',

        METADATA_CHANGE_ERROR: 'Error cambiando metadatos de archivo',

        SYMLINK_DETECTED: 'Enlace simbólico detectado: {path}',
        SYMLINK_TARGET: 'Destino de enlace simbólico: {target}',
        SYMLINK_DELETE_ERROR: 'Error eliminando enlace simbólico',

        ROOM_DIR_NOT_FOUND: 'Directorio de sala no encontrado: {room}',
        UPLOADS_DIR_NOT_FOUND: 'Directorio uploads no encontrado',
        ROOM_DELETION_START: 'Iniciando eliminación segura de sala: {room}',
        ROOM_DELETION_COMPLETE: 'Eliminación segura de sala completada: {room}',
        ROOM_DELETION_ERROR: 'Error de eliminación de sala: {room}',
        UPLOADS_DELETION_START: 'Iniciando eliminación segura de directorio uploads',
        UPLOADS_DELETION_COMPLETE: 'Eliminación segura de directorio uploads completada',
        UPLOADS_DELETION_ERROR: 'Error de eliminación de directorio uploads',
        DIR_FILE_DELETE_ERROR: 'Error eliminando archivo en directorio: {file}',
        DIR_DELETION_ERROR: 'Error eliminando directorio: {dir}',


        CORS_ENABLED: '🌐 CORS habilitado con configuración: origin={origin}',
        CORS_DISABLED: '🌐 CORS deshabilitado',


        HTTPS_ENABLED: '🔐 Servidor HTTPS iniciado en el puerto: {port}',
        HTTPS_ERROR: '❌ Error al iniciar el servidor HTTPS:',
        FALLBACK_TO_HTTP: '🔄 Volviendo al servidor HTTP',
        HTTP_REDIRECT_ENABLED: '🔀 Redirección HTTP desde el puerto {from} al puerto HTTPS {to}',


        CONNECTION_ERROR: '❌ Error de conexión al servidor',
        INVALID_HTTPS_CERTIFICATE: '❌ Certificado HTTPS inválido',
        SSL_CERTIFICATE_EXPIRED: '❌ Certificado SSL expirado',
        SSL_CERTIFICATE_NOT_YET_VALID: '❌ Certificado SSL aún no válido',


        SERVER_START: '🚀 SERVIDOR INICIADO EN EL PUERTO:',
        PORT_AVAILABLE: '✅ Puerto disponible para usar',
        PORT_BUSY: '❌ PUERTO OCUPADO:',
        PORT_BUSY_SOLUTIONS: '🔧 Soluciones: 1) Cierre otra aplicación en este puerto 2) Cambie el puerto en config.json 3) Reinicie el servidor',


        TURN_SERVERS_ENABLED: '🔄 SERVIDORES TURN HABILITADOS',
        TURN_SERVERS_DISABLED: '🔴 SERVIDORES TURN DESHABILITADOS',
        TURN_WARNING: '⚠️ ADVERTENCIA: Los servidores TURN están deshabilitados. WebRTC puede no funcionar detrás de NAT',
        TURN_SERVER_COUNT: '📊 Total de servidores TURN:',


        MAX_FILE_SIZE: '📁 Tamaño máximo de archivo:',
        MB: 'MB',
        FILE_STORAGE_PATH: '📂 Ruta de almacenamiento de archivos:',


        TURN_STATUS: '🌐 Estado de TURN:',
        TURN_ENABLED: 'HABILITADO',
        TURN_DISABLED: 'DESHABILITADO',
        ICE_SERVERS_COUNT: '🧊 Total de servidores ICE:',

        REDIRECT_PORT_BUSY: '❌ Puerto de redirección ocupado: {port}',
        REDIRECT_LOG: '🔄 Redirección: {ip} → {from} → {to}',
        REDIRECT_DISABLED: 'ℹ️ Redirección HTTP deshabilitada por puerto ocupado',

         HTTPS_SERVER_STARTED: '🔐 Servidor HTTPS iniciado en el puerto:',
        SSL_CERTIFICATES: '🔐 Certificados SSL:',
        SSL_KEY: '   Clave:',
        SSL_CERT: '   Certificado:',
        SSL_CA: '   CA:'
    },

    zh: {
        ERROR_WRONG_PASSWORD: '密码错误',
        ERROR_USERNAME_EXISTS: '此房间中已存在同名用户',
        SERVER_START: '🚀 服务器已启动在端口:',
        PORT_AVAILABLE: '✅ 端口可用',
        PORT_BUSY: '❌ 错误: 端口已被占用!',
        PORT_BUSY_SOLUTIONS: '   可能的解决方案:\n   1. 在config.json中更改端口\n   2. 关闭使用此端口的其他应用程序\n   3. 等待几秒钟后重试',

        NEW_CONNECTION: '新连接:',
        USER_JOINED_ROOM: '用户进入房间',
        USER_LEFT_ROOM: '用户离开房间',

        TURN_SERVERS_ENABLED: 'TURN 服务器: 已启用',
        TURN_SERVERS_DISABLED: 'TURN 服务器: 已禁用',
        TURN_WARNING: '⚠️  WebRTC连接可能无法通过NAT/防火墙',
        TURN_NOT_CONFIGURED: 'ℹ️  未在config.json中配置TURN服务器',
        TURN_DISABLED_IN_SETTINGS: 'ℹ️  TURN服务器在设置中已禁用 (useTurnServers: false)',
        ICE_SERVERS_COUNT: 'ICE服务器总数:',

        TURN_SERVER_DETAILS: 'TURN服务器',
        TURN_URL: 'URL:',
        TURN_USERNAME: '用户名:',
        TURN_PASSWORD: '密码:',
        TURN_MISSING_URL: '❌ 错误: 缺少TURN服务器URL',
        TURN_INVALID_PROTOCOL: '❌ 错误: URL中的协议无效。允许: turn:, turns:, stun:',
        TURN_MISSING_CREDENTIALS: '❌ 错误: 缺少TURN服务器凭据',
        TURN_CREDENTIALS_OK: '✅ 凭据存在',
        TURN_PORT: '端口:',
        TURN_INVALID_PORT: '❌ 错误: 端口号无效',
        TURN_LOW_PORT_WARNING: '⚠️  警告: 端口 < 1024可能需要管理员权限',
        TURN_SERVER_COUNT: 'TURN服务器总数:',

        ERROR_ACCESSING_CAMERA: '无法访问摄像头:',
        ERROR_STARTING_RECORDING: '开始录制错误:',
        ERROR_FILE_READING: '读取文件错误:',
        ERROR_FILE_PROCESSING: '处理视频错误',
        ERROR_FILE_UPLOAD: '视频上传错误',
        ERROR_RECORDING: '无法录制视频',
        ERROR_SERVER_CONNECTION: '无服务器连接',
        ERROR_SOCKET_CONNECTION: '无服务器连接。等待连接...',
        ERROR_SENDING_VIDEO: '发送视频错误:',
        ERROR_SENDING_FILE: '发送文件错误:',
        ERROR_SAVING_FILE: '保存文件错误',
        ERROR_SAVING_AUDIO_FILE: '保存音频文件错误',
        ERROR_SAVING: '保存错误',

        MAX_FILE_SIZE: '📁 最大文件大小:',
        FILE_STORAGE_PATH: '💾 消息和文件存储在:',
        TURN_STATUS: '🔧 TURN服务器使用:',
        TURN_ENABLED: '已启用',
        TURN_DISABLED: '已禁用',
        MB: 'MB',
        KB: 'KB',
        BYTES: '字节',

        CHAT_HISTORY_CLEARED: '聊天历史记录已清除',
        HISTORY_CLEARED_BY_USER: '聊天历史记录被用户{username}清除',
        USER_JOINED: '用户{username}加入房间',
        USER_LEFT: '用户{username}离开房间',
        DOUBLE_LOGIN_WARNING: '警告! 尝试以已登录用户{username}身份从另一设备登录!',
        KILLALL_MESSAGE: '服务器上所有用户文件已被删除。服务器已关闭。需要手动重新启动干净服务器!',
        FILES_TOO_BIG: '文件太大。最大大小:',
        FAILED_TO_SEND_FILE: '无法发送文件',
        SYSTEM: '系统',

        MESSAGE_DELETION_REQUESTED: '请求删除消息',
        MESSAGE_NOT_FOUND: '消息未找到',
        MESSAGE_SUCCESSFULLY_DELETED: '成功删除消息',
        CANNOT_DELETE_OTHERS_MESSAGES: '不能删除其他用户的消息',
        ATTEMPTS_TO_DELETE_MESSAGE_OF: '尝试删除消息的用户',
        FILE_DELETION_ERROR: '无法删除消息文件',
        CONFIRM_DELETION: '删除确认',
        DELETE_CONFIRMATION_TEXT: '您真的想永久删除此消息吗?',
        IN_ROOM: '在房间',
        FOR_USER: '为用户',
        STARTING_FILE_DELETION: '开始删除消息文件',
        OF_USER: '的用户',
        FOUND_FILEURLS_IN_XML: '在XML中找到fileUrls',
        XML_MESSAGE_NOT_FOUND: 'XML消息文件未找到',
        ERROR_DELETING_FILE: '删除文件错误',
        ERROR_DELETING_RELATED_FILE: '删除相关文件错误',
        FILE_DELETION_COMPLETED: '文件删除完成',
        GENERAL_FILE_DELETION_ERROR: '通用文件删除错误',

        REACTION_ADDED: '添加了反应',
        REACTION_ALREADY_ADDED: '已为消息添加过反应',
        TO_MESSAGE: '到消息',
        FOR_MESSAGE: '为消息',
        ERROR_UPDATING_REACTIONS_IN_FILE: '更新文件中反应错误',

        CAMERA_ACCESS_REQUEST: '请求摄像头访问...',
        CAMERA_ACCESS_GRANTED: '摄像头访问已授予',
        VIDEO_UPLOAD_PREPARATION: '准备上传视频',
        VIDEO_DATA_SIZE: '视频数据大小:',
        VIDEO_ENCRYPTION_START: '发送前加密视频',
        VIDEO_SUCCESSFULLY_ENCRYPTED: '视频已成功加密',
        VIDEO_NO_ENCRYPTION_KEY: '未设置加密密钥，视频未经加密发送',
        VIDEO_SENDING_TO_SERVER: '发送视频到服务器',
        VIDEO_SUCCESSFULLY_SENT: '视频已成功发送',
        AUDIO_MESSAGE_RECEIVED_FROM_USER: '从用户收到音频消息',
        AUDIO_DATA_SIZE: '音频数据大小',
        AUDIO_FILE_SAVED: '音频文件已保存',
        AUDIO_MESSAGE_SAVED: '音频消息已保存',
        AUDIO_MESSAGE_SENT_TO_ROOM: '音频消息发送到房间',

        XML_READ_ERROR: '读取XML消息文件错误:',
        XML_CHECK_ERROR: '检查消息错误',

        SERVER_SHUTDOWN: '服务器因killall命令关闭',
        UPLOADS_FOLDER_DELETED: '上传文件夹及其所有内容已删除',
        ROOM_FOLDER_DELETED: '房间文件夹因kill命令删除',
        ACTIVATED_KILLALL_COMMAND: '激活了killall命令',
        CLEARED_CHAT_AND_FILES: '清除了聊天室并删除了文件',
        REASON: '原因',
        CALL_REJECTED: '呼叫被拒绝',

        MESSAGE_SAVED: '消息已保存:',
        SYSTEM_MESSAGE_SAVED: '系统消息已保存:',
        FILE_METADATA_SAVED: '文件元数据已保存:',
        FILE_SAVED: '文件已保存:',
        FILE_DELETED: '文件已删除:',
        RELATED_FILE_DELETED: '相关文件已删除:',
        XML_MESSAGE_DELETED: 'XML消息文件已删除:',
        REACTIONS_UPDATED: '文件中的反应已更新:',
        MESSAGE_SAVED_TO_FILE: '消息已保存到文件:',
        FILE_MESSAGE_SAVED: '文件消息已保存:',

        MESSAGE_LOAD_ERROR: '加载房间消息错误:',
        SINGLE_MESSAGE_LOAD_ERROR: '读取消息文件错误:',
        MESSAGE_SAVE_ERROR: '保存消息到文件错误:',
        SYSTEM_MESSAGE_SAVE_ERROR: '保存系统消息到文件错误:',
        FILE_METADATA_SAVE_ERROR: '保存文件元数据错误:',

        UNKNOWN_USER: '未知用户',
        USER_DIR_NOT_FOUND: '用户目录未找到:',

        STORAGE_TYPE_DETECTED: '存储类型检测为: {type}',
        STORAGE_DETECTION_ERROR: '存储类型检测错误',
        SECURE_DELETE_DISABLED: '安全删除在配置中已禁用',
        SECURE_DELETE_START: '开始安全删除文件: {path} ({size})',
        SECURE_DELETE_COMPLETE: '安全删除完成: {path} (耗时 {time} 秒)',
        SECURE_DELETE_ERROR: '安全文件删除错误',
        FILE_DELETE_FAILED: '无法删除文件 {file} 路径 {path}. 错误: {error}',

        SSD_OPTIMIZED_DELETE: '针对SSD的优化删除',
        HDD_FULL_DELETE: '针对HDD/磁存储的完全删除',
        SSD_DELETE_ERROR: 'SSD删除错误',
        HDD_DELETE_ERROR: 'HDD删除错误',

        GOST_OVERWRITE_START: 'ГОСТ Р 50739-9 覆盖写入 ({passes} 次)',
        GOST_OVERWRITE_COMPLETE: 'ГОСТ 覆盖写入完成',
        GOST_OVERWRITE_ERROR: 'ГОСТ 覆盖写入错误',
        GOST_PASS_1_START: 'ГОСТ 第1次: 随机数据',
        GOST_PASS_1_COMPLETE: 'ГОСТ 第1次完成',
        GOST_PASS_2_START: 'ГОСТ 第2次: 固定模式',
        GOST_PASS_2_COMPLETE: 'ГОСТ 第2次完成',

        VERIFICATION_FAILED: '删除验证失败',
        VERIFICATION_FAILED_SIZE: '验证失败: 文件 {path} 大小为 {size} 字节',
        VERIFICATION_ERROR: '删除验证错误',

        METADATA_CHANGE_ERROR: '文件元数据更改错误',

        SYMLINK_DETECTED: '检测到符号链接: {path}',
        SYMLINK_TARGET: '符号链接目标: {target}',
        SYMLINK_DELETE_ERROR: '符号链接删除错误',

        ROOM_DIR_NOT_FOUND: '房间目录未找到: {room}',
        UPLOADS_DIR_NOT_FOUND: '上传目录未找到',
        ROOM_DELETION_START: '开始安全删除房间: {room}',
        ROOM_DELETION_COMPLETE: '房间安全删除完成: {room}',
        ROOM_DELETION_ERROR: '房间删除错误: {room}',
        UPLOADS_DELETION_START: '开始安全删除上传目录',
        UPLOADS_DELETION_COMPLETE: '上传目录安全删除完成',
        UPLOADS_DELETION_ERROR: '上传目录删除错误',
        DIR_FILE_DELETE_ERROR: '目录文件删除错误: {file}',
        DIR_DELETION_ERROR: '目录删除错误: {dir}',


        CORS_ENABLED: '🌐 CORS 已启用，设置：origin={origin}',
        CORS_DISABLED: '🌐 CORS 已禁用',


        HTTPS_ENABLED: '🔐 HTTPS 服务器已启动，端口：{port}',
        HTTPS_ERROR: '❌ HTTPS 服务器启动错误：',
        FALLBACK_TO_HTTP: '🔄 回退到 HTTP 服务器',
        HTTP_REDIRECT_ENABLED: '🔀 HTTP 从端口 {from} 重定向到 HTTPS 端口 {to}',


        CONNECTION_ERROR: '❌ 服务器连接错误',
        INVALID_HTTPS_CERTIFICATE: '❌ 无效的 HTTPS 证书',
        SSL_CERTIFICATE_EXPIRED: '❌ SSL 证书已过期',
        SSL_CERTIFICATE_NOT_YET_VALID: '❌ SSL 证书尚未生效',


        SERVER_START: '🚀 服务器已启动，端口：',
        PORT_AVAILABLE: '✅ 端口可用',
        PORT_BUSY: '❌ 端口被占用：',
        PORT_BUSY_SOLUTIONS: '🔧 解决方案：1) 关闭此端口上的其他应用程序 2) 在 config.json 中更改端口 3) 重启服务器',


        TURN_SERVERS_ENABLED: '🔄 TURN 服务器已启用',
        TURN_SERVERS_DISABLED: '🔴 TURN 服务器已禁用',
        TURN_WARNING: '⚠️ 警告：TURN 服务器已禁用。WebRTC 在 NAT 后可能无法工作',
        TURN_SERVER_COUNT: '📊 TURN 服务器总数：',


        MAX_FILE_SIZE: '📁 最大文件大小：',
        MB: 'MB',
        FILE_STORAGE_PATH: '📂 文件存储路径：',


        TURN_STATUS: '🌐 TURN 状态：',
        TURN_ENABLED: '已启用',
        TURN_DISABLED: '已禁用',
        ICE_SERVERS_COUNT: '🧊 ICE 服务器总数：',

        REDIRECT_PORT_BUSY: '❌ 重定向端口被占用: {port}',
        REDIRECT_LOG: '🔄 重定向: {ip} → {from} → {to}',
        REDIRECT_DISABLED: 'ℹ️ 由于端口被占用，HTTP 重定向已禁用',

        HTTPS_SERVER_STARTED: '🔐 HTTPS 服务器已启动，端口：',
        SSL_CERTIFICATES: '🔐 SSL 证书：',
        SSL_KEY: '   密钥：',
        SSL_CERT: '   证书：',
        SSL_CA: '   CA：'
    }
};

function translate(language, key, params = {}) {
    const lang = language || 'ru';
    let translation = translations[lang] && translations[lang][key]
        ? translations[lang][key]
        : translations['ru'][key] || key;

    if (typeof translation === 'string') {
        translation = translation.replace(/\{(\w+)\}/g, (match, placeholder) => {
            return params[placeholder] !== undefined ? params[placeholder] : match;
        });
    }

    return translation;
}

module.exports = { translate, translations };