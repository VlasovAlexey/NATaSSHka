const translations = {
    ru: {
        EMAIL_CLICK_TO_SEND: 'Электронная почта',
        PHONE_CLICK_TO_CALL: 'Звонок по номеру',
        LINK_CLICK_TO_OPEN: 'Сторонняя ссылка',
        APP_TITLE: 'NATaSSHka',
        JOIN_CHAT: 'Вход в чат',
        USERNAME_PLACEHOLDER: 'Имя пользователя',
        USERNAME_PATTERN_TITLE: 'Только латинские буквы, цифры, дефис и нижнее подчеркивание (макс. 64 символа)',
        ROOM_PLACEHOLDER: 'Название комнаты',
        ROOM_DEFAULT_VALUE: 'Room_01',
        PASSWORD_PLACEHOLDER: 'Пароль',
        JOIN_BUTTON: 'Войти',
        LANGUAGE_SELECTOR: 'Язык',
        
        MESSAGE_PLACEHOLDER: 'Введите сообщение...',
        ENCRYPTION_KEY_PLACEHOLDER: 'Ключ шифрования',
        
        ERROR_REQUIRED_FIELDS: 'Заполните все поля',
        ERROR_INVALID_USERNAME: 'Имя пользователя может содержать только латинские буквы, цифры, дефис и нижнее подчеркивание (макс. 64 символа)',
        ERROR_INVALID_ROOM: 'Название комнаты может содержать только латинские буквы, цифры, дефис и нижнее подчеркивание (макс. 64 символа)',
        ERROR_MEDIA_NOT_SUPPORTED: 'Ваш браузер не поддерживает доступ к медиаустройствам',
        ERROR_MEDIA_PERMISSION: 'Не удалось получить доступ к микрофону: {error}',
        ERROR_CAMERA_PERMISSION: 'Не удалось получить доступ к камере: {error}',
        ERROR_MEDIARECORDER_NOT_SUPPORTED: 'MediaRecorder не поддерживается вашим браузером',
        ERROR_NO_SERVER_CONNECTION: 'Нет соединения с сервером',
        ERROR_AUDIO_RECORD: 'Не удалось записать аудио',
        ERROR_VIDEO_RECORD: 'Не удалось записать видео',
        ERROR_FILE_READ: 'Ошибка чтения файла: {filename}',
        ERROR_FILE_SEND: 'Ошибка отправки файла {filename}: {error}',
        ERROR_FILE_TOO_LARGE: 'Файл слишком большой. Максимальный размер: 50 МБ',
        ERROR_PROCESSING_AUDIO: 'Ошибка обработки аудио',
        ERROR_PROCESSING_VIDEO: 'Ошибка обработки видео',
        ERROR_SENDING_AUDIO: 'Ошибка отправки аудиосообщения',
        ERROR_SENDING_VIDEO: 'Ошибка отправки видеосообщения',
        ERROR_ENCRYPTION: '🔒 Ошибка дешифрования',
        ERROR_WRONG_ENCRYPTION_KEY: '🔒 Неверный ключ шифрования',
        ERROR_DELETE_MESSAGE: 'Не удалось удалить сообщение: {error}',
        ERROR_MESSAGE_NOT_FOUND: 'Сообщение не найдено',
        ERROR_CANNOT_DELETE_OTHERS: 'Нельзя удалять чужие сообщения',
        ERROR_UNAUTHORIZED: 'Пользователь не авторизован',
        ERROR_FILE_DELETE: 'Не удалось удалить файлы сообщения',
        ERROR_CALL_START: 'Не удалось начать звонок: {error}',
        ERROR_CALL_ACCEPT: 'Не удалось принять звонок: {error}',
        ERROR_INSECURE_CONTEXT: 'Для работы голосовой и видео связи рекомендуется использовать HTTPS или localhost.',
        
        SYSTEM_CHAT_CLEARED: 'История чата была очищена',
        SYSTEM_USER_JOINED: 'Пользователь {username} присоединился к комнате',
        SYSTEM_USER_LEFT: 'Пользователь {username} вышел из комнате',
        SYSTEM_SERVER_SHUTDOWN: 'Сервер завершил работу. Страница будет перезагружена.',
        
        SEND_MESSAGE: 'Отправить сообщение',
        SEND_MESSAGE_TOOLTIP: 'Введите сообщение для отправки',
        SEND_MESSAGE_BUTTON: '↵',
        ADD_REACTION: 'Добавить реакцию',
        DELETE_MESSAGE: 'Удалить сообщение',
        CLEAR_KEY: 'Очистить ключ',
        CANCEL: 'Отмена',
        CONFIRM: 'Подтвердить',
        CONFIRM_DELETE: 'Удалить',
        OK: 'OK',
        
        MODAL_INFO: 'Информация',
        MODAL_ERROR: 'Ошибка',
        MODAL_CALL: 'Звонок',
        MODAL_CONFIRM_DELETE: 'Подтверждение удаления',
        MODAL_CONFIRM_DELETE_TEXT: 'Вы действительно хотите безвозвратно удалить это сообщение?',
        MODAL_DELETING: 'Удаление...',
        MODAL_PREPARING_DEVICE: 'Подготовка устройства для записи. Ждите...',
        MODAL_INCOMING_CALL: 'Входящий звонок',
        MODAL_INCOMING_CALL_INFO: 'Пользователь {username} звонит вам ({type})',
        MODAL_ACCEPT_CALL: 'Принять',
        MODAL_REJECT_CALL: 'Отклонить',
        MODAL_SELECT_USER: 'Выберите пользователя для звонка',
        MODAL_NO_USERS: 'В комнате нет других пользователей',
        MODAL_CALL_REJECTED: 'Пользователь {username} отклонил звонок',
        MODAL_CALL_ENDED: 'Пользователь {username} завершил звонок',
        MODAL_CALL_NO_ANSWER: 'Пользователь не ответил на звонок',
        MODAL_ALREADY_IN_CALL: 'Уже в звонке',
        
        RECORDING_AUDIO: 'Запись аудио...',
        RECORDING_VIDEO: 'Запись...',
        RECORDING_TIMER: '{seconds} сек',
        
        FILE_LOADING_DECRYPTING: 'Загрузка и расшифровка...',
        FILE_ENCRYPTED: 'Файл зашифрован. Нажмите для расшифровки.',
        FILE_ENCRYPTED_CLICK: '🔒 Файл зашифрован. Нажмите для расшифровки.',
        FILE_WRONG_KEY: '🔒 Ключ дешифрации не верный.',
        FILE_DOWNLOAD: 'Скачать',
        FILE_SIZE: '{size} KB',
        FILE_DURATION_SIZE: '{duration} сек • {size}',
        
        NOTIFICATION_TEST_TITLE: 'NATaSSHka - Уведомления включены',
        NOTIFICATION_TEST_BODY: 'Вы будете получать уведомления о новых сообщениях',
        NOTIFICATION_NEW_MESSAGE: 'Новое сообщение от {username}',
        NOTIFICATION_VOICE_MESSAGE: '🎤 Голосовое сообщение от {username}',
        NOTIFICATION_IMAGE_MESSAGE: '🖼️ Изображение от {username}',
        NOTIFICATION_VIDEO_MESSAGE: '🎥 Видео от {username}',
        NOTIFICATION_FILE_MESSAGE: '📎 Файл от {username}',
        NOTIFICATION_ENCRYPTED_MESSAGE: '🔒 Зашифрованное сообщение',
        NOTIFICATION_VOICE_DURATION: 'Длительность: {duration} сек',
        NOTIFICATION_IMAGE_FILE: 'Файл: {filename}',
        NOTIFICATION_VIDEO_DURATION: 'Длительность: {duration} сек',
        NOTIFICATION_FILE_INFO: 'Файл: {filename} ({size})',
        
        UPLOADING: 'Загрузка: {filename}',
        UPLOAD_ERROR: 'Ошибка загрузки!',
        
        ROOM_INFO: 'Комната: {room}',
        USER_INFO: '✪ {username}',
        
        END_CALL: 'Завершить звонок',
        AUDIO_CALL: 'Аудиозвонок',
        VIDEO_CALL: 'Видеозвонок',
        
        VIDEO_NOT_SUPPORTED: 'Ваш браузер не поддерживает видео.',
        IMAGE_LOAD_ERROR: 'Ошибка загрузки изображения',
        VIDEO_LOAD_ERROR: 'Ваш браузер не поддерживает видео.',
        
        SIDEBAR_TOGGLE_SHOW: 'Показать боковую панель',
        SIDEBAR_TOGGLE_HIDE: 'Скрыть боковую панель',

        VIDEO_LOAD_ERROR: 'Ошибка загрузки видео',
        IMAGE_LOAD_ERROR: 'Ошибка загрузки изображения',
        MEDIA_LOAD_ERROR: 'Ошибка загрузки медиафайла',
        UNSUPPORTED_FORMAT: 'Формат не поддерживается',
        BROWSER_NOT_SUPPORTED: 'Ваш браузер не поддерживает этот формат'
    },
    
    en: {
        EMAIL_CLICK_TO_SEND: 'Email',
        PHONE_CLICK_TO_CALL: 'Call',
        LINK_CLICK_TO_OPEN: 'Third-party link',
        APP_TITLE: 'NATaSSHka',
        JOIN_CHAT: 'Join Chat',
        USERNAME_PLACEHOLDER: 'Username',
        USERNAME_PATTERN_TITLE: 'Only Latin letters, numbers, hyphen and underscore (max 64 characters)',
        ROOM_PLACEHOLDER: 'Room name',
        ROOM_DEFAULT_VALUE: 'Room_01',
        PASSWORD_PLACEHOLDER: 'Password',
        JOIN_BUTTON: 'Join',
        LANGUAGE_SELECTOR: 'Language',
        
        MESSAGE_PLACEHOLDER: 'Type a message...',
        ENCRYPTION_KEY_PLACEHOLDER: 'Encryption key',
        
        ERROR_REQUIRED_FIELDS: 'Please fill in all fields',
        ERROR_INVALID_USERNAME: 'Username can only contain Latin letters, numbers, hyphen and underscore (max 64 characters)',
        ERROR_INVALID_ROOM: 'Room name can only contain Latin letters, numbers, hyphen and underscore (max 64 characters)',
        ERROR_MEDIA_NOT_SUPPORTED: 'Your browser does not support media devices',
        ERROR_MEDIA_PERMISSION: 'Failed to access microphone: {error}',
        ERROR_CAMERA_PERMISSION: 'Failed to access camera: {error}',
        ERROR_MEDIARECORDER_NOT_SUPPORTED: 'MediaRecorder is not supported by your browser',
        ERROR_NO_SERVER_CONNECTION: 'No connection to server',
        ERROR_AUDIO_RECORD: 'Failed to record audio',
        ERROR_VIDEO_RECORD: 'Failed to record video',
        ERROR_FILE_READ: 'Error reading file: {filename}',
        ERROR_FILE_SEND: 'Error sending file {filename}: {error}',
        ERROR_FILE_TOO_LARGE: 'File is too large. Maximum size: 50 MB',
        ERROR_PROCESSING_AUDIO: 'Error processing audio',
        ERROR_PROCESSING_VIDEO: 'Error processing video',
        ERROR_SENDING_AUDIO: 'Error sending audio message',
        ERROR_SENDING_VIDEO: 'Error sending video message',
        ERROR_ENCRYPTION: '🔒 Decryption error',
        ERROR_WRONG_ENCRYPTION_KEY: '🔒 Wrong encryption key',
        ERROR_DELETE_MESSAGE: 'Failed to delete message: {error}',
        ERROR_MESSAGE_NOT_FOUND: 'Message not found',
        ERROR_CANNOT_DELETE_OTHERS: 'Cannot delete others messages',
        ERROR_UNAUTHORIZED: 'User not authorized',
        ERROR_FILE_DELETE: 'Failed to delete message files',
        ERROR_CALL_START: 'Failed to start call: {error}',
        ERROR_CALL_ACCEPT: 'Failed to accept call: {error}',
        ERROR_INSECURE_CONTEXT: 'For voice and video calls, HTTPS or localhost is recommended.',
        
        SYSTEM_CHAT_CLEARED: 'Chat history has been cleared',
        SYSTEM_USER_JOINED: 'User {username} joined the room',
        SYSTEM_USER_LEFT: 'User {username} left the room',
        SYSTEM_SERVER_SHUTDOWN: 'Server has shut down. Page will reload.',
        
        SEND_MESSAGE: 'Send message',
        SEND_MESSAGE_TOOLTIP: 'Enter a message to send',
        SEND_MESSAGE_BUTTON: '↵',
        ADD_REACTION: 'Add reaction',
        DELETE_MESSAGE: 'Delete message',
        CLEAR_KEY: 'Clear key',
        CANCEL: 'Cancel',
        CONFIRM: 'Confirm',
        CONFIRM_DELETE: 'Delete',
        OK: 'OK',
        
        MODAL_INFO: 'Information',
        MODAL_ERROR: 'Error',
        MODAL_CALL: 'Call',
        MODAL_CONFIRM_DELETE: 'Confirm deletion',
        MODAL_CONFIRM_DELETE_TEXT: 'Are you sure you want to permanently delete this message?',
        MODAL_DELETING: 'Deleting...',
        MODAL_PREPARING_DEVICE: 'Preparing device for recording. Please wait...',
        MODAL_INCOMING_CALL: 'Incoming call',
        MODAL_INCOMING_CALL_INFO: 'User {username} is calling you ({type})',
        MODAL_ACCEPT_CALL: 'Accept',
        MODAL_REJECT_CALL: 'Reject',
        MODAL_SELECT_USER: 'Select user for call',
        MODAL_NO_USERS: 'No other users in the room',
        MODAL_CALL_REJECTED: 'User {username} rejected the call',
        MODAL_CALL_ENDED: 'User {username} ended the call',
        MODAL_CALL_NO_ANSWER: 'User did not answer the call',
        MODAL_ALREADY_IN_CALL: 'Already in a call',
        
        RECORDING_AUDIO: 'Recording audio...',
        RECORDING_VIDEO: 'Recording...',
        RECORDING_TIMER: '{seconds} sec',
        
        FILE_LOADING_DECRYPTING: 'Loading and decrypting...',
        FILE_ENCRYPTED: 'File is encrypted. Click to decrypt.',
        FILE_ENCRYPTED_CLICK: '🔒 File is encrypted. Click to decrypt.',
        FILE_WRONG_KEY: '🔒 Decryption key is incorrect.',
        FILE_DOWNLOAD: 'Download',
        FILE_SIZE: '{size} KB',
        FILE_DURATION_SIZE: '{duration} sec • {size}',
        
        NOTIFICATION_TEST_TITLE: 'NATaSSHka - Notifications enabled',
        NOTIFICATION_TEST_BODY: 'You will receive notifications about new messages',
        NOTIFICATION_NEW_MESSAGE: 'New message from {username}',
        NOTIFICATION_VOICE_MESSAGE: '🎤 Voice message from {username}',
        NOTIFICATION_IMAGE_MESSAGE: '🖼️ Image from {username}',
        NOTIFICATION_VIDEO_MESSAGE: '🎥 Video from {username}',
        NOTIFICATION_FILE_MESSAGE: '📎 File from {username}',
        NOTIFICATION_ENCRYPTED_MESSAGE: '🔒 Encrypted message',
        NOTIFICATION_VOICE_DURATION: 'Duration: {duration} sec',
        NOTIFICATION_IMAGE_FILE: 'File: {filename}',
        NOTIFICATION_VIDEO_DURATION: 'Duration: {duration} sec',
        NOTIFICATION_FILE_INFO: 'File: {filename} ({size})',
        
        UPLOADING: 'Uploading: {filename}',
        UPLOAD_ERROR: 'Upload error!',
        
        ROOM_INFO: 'Room: {room}',
        USER_INFO: '✪ {username}',
        
        END_CALL: 'End call',
        AUDIO_CALL: 'Audio call',
        VIDEO_CALL: 'Video call',
        
        VIDEO_NOT_SUPPORTED: 'Your browser does not support video.',
        IMAGE_LOAD_ERROR: 'Image load error',
        VIDEO_LOAD_ERROR: 'Your browser does not support video.',
        
        SIDEBAR_TOGGLE_SHOW: 'Show sidebar',
        SIDEBAR_TOGGLE_HIDE: 'Hide sidebar',
        VIDEO_LOAD_ERROR: 'Video load error',
        IMAGE_LOAD_ERROR: 'Image load error',
        MEDIA_LOAD_ERROR: 'Media load error',
        UNSUPPORTED_FORMAT: 'Format not supported',
        BROWSER_NOT_SUPPORTED: 'Your browser does not support this format'
    },
    
    es: {
        EMAIL_CLICK_TO_SEND: 'Correo electrónico',
        PHONE_CLICK_TO_CALL: 'Llamar',
        LINK_CLICK_TO_OPEN: 'Enlace de terceros',
        APP_TITLE: 'NATaSSHka',
        JOIN_CHAT: 'Unirse al chat',
        USERNAME_PLACEHOLDER: 'Nombre de usuario',
        USERNAME_PATTERN_TITLE: 'Solo letras latinas, números, guión y guión bajo (máx. 64 caracteres)',
        ROOM_PLACEHOLDER: 'Nombre de la sala',
        ROOM_DEFAULT_VALUE: 'Room_01',
        PASSWORD_PLACEHOLDER: 'Contraseña',
        JOIN_BUTTON: 'Unirse',
        LANGUAGE_SELECTOR: 'Idioma',
        
        MESSAGE_PLACEHOLDER: 'Escribe un mensaje...',
        ENCRYPTION_KEY_PLACEHOLDER: 'Clave de cifrado',
        
        ERROR_REQUIRED_FIELDS: 'Por favor complete todos los campos',
        ERROR_INVALID_USERNAME: 'El nombre de usuario solo puede contener letras latinas, números, guión y guión bajo (máx. 64 caracteres)',
        ERROR_INVALID_ROOM: 'El nombre de la sala solo puede contener letras latinas, números, guión y guión bajo (máx. 64 caracteres)',
        ERROR_MEDIA_NOT_SUPPORTED: 'Tu navegador no soporta dispositivos multimedia',
        ERROR_MEDIA_PERMISSION: 'No se pudo acceder al micrófono: {error}',
        ERROR_CAMERA_PERMISSION: 'No se pudo acceder a la cámara: {error}',
        ERROR_MEDIARECORDER_NOT_SUPPORTED: 'MediaRecorder no es compatible con tu navegador',
        ERROR_NO_SERVER_CONNECTION: 'Sin conexión al servidor',
        ERROR_AUDIO_RECORD: 'No se pudo grabar audio',
        ERROR_VIDEO_RECORD: 'No se pudo grabar video',
        ERROR_FILE_READ: 'Error al leer el archivo: {filename}',
        ERROR_FILE_SEND: 'Error al enviar el archivo {filename}: {error}',
        ERROR_FILE_TOO_LARGE: 'El archivo es demasiado grande. Tamaño máximo: 50 MB',
        ERROR_PROCESSING_AUDIO: 'Error al procesar audio',
        ERROR_PROCESSING_VIDEO: 'Error al procesar video',
        ERROR_SENDING_AUDIO: 'Error al enviar mensaje de audio',
        ERROR_SENDING_VIDEO: 'Error al enviar mensaje de video',
        ERROR_ENCRYPTION: '🔒 Error de descifrado',
        ERROR_WRONG_ENCRYPTION_KEY: '🔒 Clave de cifrado incorrecta',
        ERROR_DELETE_MESSAGE: 'No se pudo eliminar el mensaje: {error}',
        ERROR_MESSAGE_NOT_FOUND: 'Mensaje no encontrado',
        ERROR_CANNOT_DELETE_OTHERS: 'No se pueden eliminar mensajes de otros',
        ERROR_UNAUTHORIZED: 'Usuario no autorizado',
        ERROR_FILE_DELETE: 'No se pudieron eliminar los archivos del mensaje',
        ERROR_CALL_START: 'No se pudo iniciar la llamada: {error}',
        ERROR_CALL_ACCEPT: 'No se pudo aceptar la llamada: {error}',
        ERROR_INSECURE_CONTEXT: 'Para llamadas de voz y video, se recomienda HTTPS o localhost.',
        
        SYSTEM_CHAT_CLEARED: 'El historial del chat ha sido borrado',
        SYSTEM_USER_JOINED: 'El usuario {username} se unió a la sala',
        SYSTEM_USER_LEFT: 'El usuario {username} salió de la sala',
        SYSTEM_SERVER_SHUTDOWN: 'El servidor se ha apagado. La página se recargará.',
        
        SEND_MESSAGE: 'Enviar mensaje',
        SEND_MESSAGE_TOOLTIP: 'Ingrese un mensaje para enviar',
        SEND_MESSAGE_BUTTON: '↵',
        ADD_REACTION: 'Agregar reacción',
        DELETE_MESSAGE: 'Eliminar mensaje',
        CLEAR_KEY: 'Limpiar clave',
        CANCEL: 'Cancelar',
        CONFIRM: 'Confirmar',
        CONFIRM_DELETE: 'Eliminar',
        OK: 'OK',
        
        MODAL_INFO: 'Información',
        MODAL_ERROR: 'Error',
        MODAL_CALL: 'Llamada',
        MODAL_CONFIRM_DELETE: 'Confirmar eliminación',
        MODAL_CONFIRM_DELETE_TEXT: '¿Está seguro de que desea eliminar permanentemente este mensaje?',
        MODAL_DELETING: 'Eliminando...',
        MODAL_PREPARING_DEVICE: 'Preparando dispositivo para grabación. Por favor espere...',
        MODAL_INCOMING_CALL: 'Llamada entrante',
        MODAL_INCOMING_CALL_INFO: 'El usuario {username} te está llamando ({type})',
        MODAL_ACCEPT_CALL: 'Aceptar',
        MODAL_REJECT_CALL: 'Rechazar',
        MODAL_SELECT_USER: 'Seleccionar usuario para llamar',
        MODAL_NO_USERS: 'No hay otros usuarios en la sala',
        MODAL_CALL_REJECTED: 'El usuario {username} rechazó la llamada',
        MODAL_CALL_ENDED: 'El usuario {username} finalizó la llamada',
        MODAL_CALL_NO_ANSWER: 'El usuario no respondió la llamada',
        MODAL_ALREADY_IN_CALL: 'Ya en una llamada',
        
        RECORDING_AUDIO: 'Grabando audio...',
        RECORDING_VIDEO: 'Grabando...',
        RECORDING_TIMER: '{seconds} seg',
        
        FILE_LOADING_DECRYPTING: 'Cargando y descifrando...',
        FILE_ENCRYPTED: 'Archivo cifrado. Haz clic para descifrar.',
        FILE_ENCRYPTED_CLICK: '🔒 Archivo cifrado. Haz clic para descifrar.',
        FILE_WRONG_KEY: '🔒 La clave de descifrado es incorrecta.',
        FILE_DOWNLOAD: 'Descargar',
        FILE_SIZE: '{size} KB',
        FILE_DURATION_SIZE: '{duration} seg • {size}',
        
        NOTIFICATION_TEST_TITLE: 'NATaSSHka - Notificaciones habilitadas',
        NOTIFICATION_TEST_BODY: 'Recibirás notificaciones sobre nuevos mensajes',
        NOTIFICATION_NEW_MESSAGE: 'Nuevo mensaje de {username}',
        NOTIFICATION_VOICE_MESSAGE: '🎤 Mensaje de voz de {username}',
        NOTIFICATION_IMAGE_MESSAGE: '🖼️ Imagen de {username}',
        NOTIFICATION_VIDEO_MESSAGE: '🎥 Video de {username}',
        NOTIFICATION_FILE_MESSAGE: '📎 Archivo de {username}',
        NOTIFICATION_ENCRYPTED_MESSAGE: '🔒 Mensaje cifrado',
        NOTIFICATION_VOICE_DURATION: 'Duración: {duration} seg',
        NOTIFICATION_IMAGE_FILE: 'Archivo: {filename}',
        NOTIFICATION_VIDEO_DURATION: 'Duración: {duration} seg',
        NOTIFICATION_FILE_INFO: 'Archivo: {filename} ({size})',
        
        UPLOADING: 'Subiendo: {filename}',
        UPLOAD_ERROR: '¡Error de subida!',
        
        ROOM_INFO: 'Sala: {room}',
        USER_INFO: '✪ {username}',
        
        END_CALL: 'Finalizar llamada',
        AUDIO_CALL: 'Llamada de audio',
        VIDEO_CALL: 'Llamada de video',
        
        VIDEO_NOT_SUPPORTED: 'Tu navegador no soporta video.',
        IMAGE_LOAD_ERROR: 'Error al cargar imagen',
        VIDEO_LOAD_ERROR: 'Tu navegador no soporta video.',
        
        SIDEBAR_TOGGLE_SHOW: 'Mostrar barra lateral',
        SIDEBAR_TOGGLE_HIDE: 'Ocultar barra lateral',
        
        VIDEO_LOAD_ERROR: 'Error al cargar video',
        IMAGE_LOAD_ERROR: 'Error al cargar imagen',
        MEDIA_LOAD_ERROR: 'Error al cargar archivo multimedia',
        UNSUPPORTED_FORMAT: 'Formato no compatible',
        BROWSER_NOT_SUPPORTED: 'Tu navegador no soporta este formato'
    },
    
    zh: {
        EMAIL_CLICK_TO_SEND: '電子郵件',
        PHONE_CLICK_TO_CALL: '撥打電話',
        LINK_CLICK_TO_OPEN: '第三方連結',
        APP_TITLE: 'NATaSSHka',
        JOIN_CHAT: '加入聊天',
        USERNAME_PLACEHOLDER: '用户名',
        USERNAME_PATTERN_TITLE: '仅限拉丁字母、数字、连字符和下划线（最多64个字符）',
        ROOM_PLACEHOLDER: '房间名称',
        ROOM_DEFAULT_VALUE: 'Room_01',
        PASSWORD_PLACEHOLDER: '密码',
        JOIN_BUTTON: '加入',
        LANGUAGE_SELECTOR: '语言',
        
        MESSAGE_PLACEHOLDER: '输入消息...',
        ENCRYPTION_KEY_PLACEHOLDER: '加密密钥',
        
        ERROR_REQUIRED_FIELDS: '请填写所有字段',
        ERROR_INVALID_USERNAME: '用户名只能包含拉丁字母、数字、连字符和下划线（最多64个字符）',
        ERROR_INVALID_ROOM: '房间名称只能包含拉丁字母、数字、连字符和下划线（最多64个字符）',
        ERROR_MEDIA_NOT_SUPPORTED: '您的浏览器不支持媒体设备',
        ERROR_MEDIA_PERMISSION: '无法访问麦克风：{error}',
        ERROR_CAMERA_PERMISSION: '无法访问摄像头：{error}',
        ERROR_MEDIARECORDER_NOT_SUPPORTED: '您的浏览器不支持MediaRecorder',
        ERROR_NO_SERVER_CONNECTION: '无服务器连接',
        ERROR_AUDIO_RECORD: '无法录制音频',
        ERROR_VIDEO_RECORD: '无法录制视频',
        ERROR_FILE_READ: '读取文件错误：{filename}',
        ERROR_FILE_SEND: '发送文件错误 {filename}：{error}',
        ERROR_FILE_TOO_LARGE: '文件太大。最大大小：50 MB',
        ERROR_PROCESSING_AUDIO: '处理音频错误',
        ERROR_PROCESSING_VIDEO: '处理视频错误',
        ERROR_SENDING_AUDIO: '发送音频消息错误',
        ERROR_SENDING_VIDEO: '发送视频消息错误',
        ERROR_ENCRYPTION: '🔒 解密错误',
        ERROR_WRONG_ENCRYPTION_KEY: '🔒 加密密钥错误',
        ERROR_DELETE_MESSAGE: '删除消息失败：{error}',
        ERROR_MESSAGE_NOT_FOUND: '消息未找到',
        ERROR_CANNOT_DELETE_OTHERS: '不能删除他人的消息',
        ERROR_UNAUTHORIZED: '用户未授权',
        ERROR_FILE_DELETE: '无法删除消息文件',
        ERROR_CALL_START: '无法开始通话：{error}',
        ERROR_CALL_ACCEPT: '无法接听通话：{error}',
        ERROR_INSECURE_CONTEXT: '对于语音和视频通话，建议使用HTTPS或localhost。',
        
        SYSTEM_CHAT_CLEARED: '聊天记录已被清除',
        SYSTEM_USER_JOINED: '用户 {username} 加入了房间',
        SYSTEM_USER_LEFT: '用户 {username} 离开了房间',
        SYSTEM_SERVER_SHUTDOWN: '服务器已关闭。页面将重新加载。',
        
        SEND_MESSAGE: '发送消息',
        SEND_MESSAGE_TOOLTIP: '输入要发送的消息',
        SEND_MESSAGE_BUTTON: '↵',
        ADD_REACTION: '添加反应',
        DELETE_MESSAGE: '删除消息',
        CLEAR_KEY: '清除密钥',
        CANCEL: '取消',
        CONFIRM: '确认',
        CONFIRM_DELETE: '删除',
        OK: '确定',
        
        MODAL_INFO: '信息',
        MODAL_ERROR: '错误',
        MODAL_CALL: '通话',
        MODAL_CONFIRM_DELETE: '确认删除',
        MODAL_CONFIRM_DELETE_TEXT: '您确定要永久删除此消息吗？',
        MODAL_DELETING: '删除中...',
        MODAL_PREPARING_DEVICE: '正在准备录音设备。请稍候...',
        MODAL_INCOMING_CALL: '来电',
        MODAL_INCOMING_CALL_INFO: '用户 {username} 正在呼叫您（{type}）',
        MODAL_ACCEPT_CALL: '接听',
        MODAL_REJECT_CALL: '拒绝',
        MODAL_SELECT_USER: '选择通话用户',
        MODAL_NO_USERS: '房间里没有其他用户',
        MODAL_CALL_REJECTED: '用户 {username} 拒绝了通话',
        MODAL_CALL_ENDED: '用户 {username} 结束了通话',
        MODAL_CALL_NO_ANSWER: '用户未接听',
        MODAL_ALREADY_IN_CALL: '已在通话中',
        
        RECORDING_AUDIO: '正在录制音频...',
        RECORDING_VIDEO: '正在录制...',
        RECORDING_TIMER: '{seconds} 秒',
        
        FILE_LOADING_DECRYPTING: '正在加载和解密...',
        FILE_ENCRYPTED: '文件已加密。点击解密。',
        FILE_ENCRYPTED_CLICK: '🔒 文件已加密。点击解密。',
        FILE_WRONG_KEY: '🔒 解密密钥不正确。',
        FILE_DOWNLOAD: '下载',
        FILE_SIZE: '{size} KB',
        FILE_DURATION_SIZE: '{duration} 秒 • {size}',
        
        NOTIFICATION_TEST_TITLE: 'NATaSSHka - 通知已启用',
        NOTIFICATION_TEST_BODY: '您将收到新消息的通知',
        NOTIFICATION_NEW_MESSAGE: '来自 {username} 的新消息',
        NOTIFICATION_VOICE_MESSAGE: '🎤 来自 {username} 的语音消息',
        NOTIFICATION_IMAGE_MESSAGE: '🖼️ 来自 {username} 的图片',
        NOTIFICATION_VIDEO_MESSAGE: '🎥 来自 {username} 的视频',
        NOTIFICATION_FILE_MESSAGE: '📎 来自 {username} 的文件',
        NOTIFICATION_ENCRYPTED_MESSAGE: '🔒 加密消息',
        NOTIFICATION_VOICE_DURATION: '时长：{duration} 秒',
        NOTIFICATION_IMAGE_FILE: '文件：{filename}',
        NOTIFICATION_VIDEO_DURATION: '时长：{duration} 秒',
        NOTIFICATION_FILE_INFO: '文件：{filename}（{size}）',
        
        UPLOADING: '正在上传：{filename}',
        UPLOAD_ERROR: '上传错误！',
        
        ROOM_INFO: '房间：{room}',
        USER_INFO: '✪ {username}',
        
        END_CALL: '结束通话',
        AUDIO_CALL: '语音通话',
        VIDEO_CALL: '视频通话',
        
        VIDEO_NOT_SUPPORTED: '您的浏览器不支持视频。',
        IMAGE_LOAD_ERROR: '图片加载错误',
        VIDEO_LOAD_ERROR: '您的浏览器不支持视频。',
        
        SIDEBAR_TOGGLE_SHOW: '显示侧边栏',
        SIDEBAR_TOGGLE_HIDE: '隐藏侧边栏',

        VIDEO_LOAD_ERROR: '视频加载错误',
        IMAGE_LOAD_ERROR: '图片加载错误',
        MEDIA_LOAD_ERROR: '媒体文件加载错误',
        UNSUPPORTED_FORMAT: '格式不支持',
        BROWSER_NOT_SUPPORTED: '您的浏览器不支持此格式'
    }
};

class LanguageManager {
    constructor() {
        this.currentLanguage = 'en'; // По умолчанию английский
        this.init();
    }
    
    init() {
        const savedLang = localStorage.getItem('chat_language');
        if (savedLang && translations[savedLang]) {
            this.currentLanguage = savedLang;
        }
        
        this.updatePageTitle();
        
        // Обновляем интерфейс сразу при загрузке
        setTimeout(() => {
            this.updateLoginModal();
            this.updateInterfaceLanguage();
        }, 100);
    }
    
    updatePageTitle() {
        document.title = this.t('APP_TITLE');
    }
    
    t(key, params = {}) {
        let translation = translations[this.currentLanguage] && translations[this.currentLanguage][key] 
            ? translations[this.currentLanguage][key] 
            : translations['en'][key] || key;
        
        if (typeof translation === 'string') {
            translation = translation.replace(/\{(\w+)\}/g, (match, placeholder) => {
                return params[placeholder] !== undefined ? params[placeholder] : match;
            });
        }
        
        return translation;
    }
    
    setLanguage(lang) {
        if (translations[lang]) {
            this.currentLanguage = lang;
            localStorage.setItem('chat_language', lang);
            this.updatePageTitle();
            this.updateLoginModal();
            this.updateInterfaceLanguage();
            return true;
        }
        return false;
    }
    
    updateLoginModal() {
        const loginModal = document.getElementById('loginModal');
        if (!loginModal) return;
        
        // Обновляем только если модальное окно видимо (не скрыто)
        if (!loginModal.classList.contains('hidden')) {
            const modalTitle = loginModal.querySelector('h2');
            if (modalTitle) modalTitle.textContent = this.t('JOIN_CHAT');
            
            const usernameInput = document.getElementById('usernameInput');
            if (usernameInput) {
                usernameInput.placeholder = this.t('USERNAME_PLACEHOLDER');
                usernameInput.title = this.t('USERNAME_PATTERN_TITLE');
            }
            
            const roomInput = document.getElementById('roomInput');
            if (roomInput) {
                roomInput.placeholder = this.t('ROOM_PLACEHOLDER');
                roomInput.title = this.t('USERNAME_PATTERN_TITLE');
            }
            
            const passwordInput = document.getElementById('passwordInput');
            if (passwordInput) passwordInput.placeholder = this.t('PASSWORD_PLACEHOLDER');
            
            const joinButton = document.getElementById('joinChatBtn');
            if (joinButton) joinButton.textContent = this.t('JOIN_BUTTON');
            
            const languageSelect = document.getElementById('languageSelect');
            if (languageSelect) {
                const labels = {
                    'en': 'English',
                    'ru': 'Русский',
                    'es': 'Español',
                    'zh': '中文'
                };
                
                for (let option of languageSelect.options) {
                    if (labels[option.value]) {
                        option.textContent = labels[option.value];
                    }
                }
                
                const label = languageSelect.previousElementSibling;
                if (label && label.tagName === 'LABEL') {
                    label.textContent = this.t('LANGUAGE_SELECTOR') + ':';
                }
            }
        }
    }
    
    updateInterfaceLanguage() {
        // Обновляем поля, которые всегда видны
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.placeholder = this.t('MESSAGE_PLACEHOLDER');
        }
        
        const encryptionKeyInput = document.getElementById('encryptionKeyInput');
        if (encryptionKeyInput) {
            encryptionKeyInput.placeholder = this.t('ENCRYPTION_KEY_PLACEHOLDER');
        }
        
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        if (sendMessageBtn) {
            sendMessageBtn.title = this.t('SEND_MESSAGE_TOOLTIP');
        }
        
        const audioCallBtn = document.getElementById('audioCallBtn');
        if (audioCallBtn) {
            audioCallBtn.title = this.t('AUDIO_CALL');
        }
        
        const videoCallBtn = document.getElementById('videoCallBtn');
        if (videoCallBtn) {
            videoCallBtn.title = this.t('VIDEO_CALL');
        }
        
        const recordButton = document.getElementById('recordButton');
        if (recordButton) {
            const recordingText = document.getElementById('recordingText');
            if (recordingText) {
                recordingText.textContent = this.t('RECORDING_AUDIO');
            }
        }
        
        const videoRecordingText = document.getElementById('videoRecordingText');
        if (videoRecordingText) {
            videoRecordingText.textContent = this.t('RECORDING_VIDEO');
        }
        
        const preparingModalTitle = document.getElementById('preparingModalTitle');
        if (preparingModalTitle) {
            preparingModalTitle.textContent = this.t('MODAL_PREPARING_DEVICE');
        }
        
        // Обновляем тексты в уже созданных модальных окнах
        this.updateModalTexts();
    }
    
    updateModalTexts() {
        // Обновляем текст в модальном окне сообщений, если оно видимо
        const messageModal = document.getElementById('messageModal');
        if (messageModal && !messageModal.classList.contains('hidden')) {
            const messageModalTitle = messageModal.querySelector('#messageModalTitle');
            if (messageModalTitle && messageModalTitle.textContent === 'Сообщение') {
                messageModalTitle.textContent = this.t('MODAL_INFO');
            }
            
            const messageModalOkBtn = messageModal.querySelector('#messageModalOkBtn');
            if (messageModalOkBtn && messageModalOkBtn.textContent === 'OK') {
                messageModalOkBtn.textContent = this.t('OK');
            }
        }
    }
    
    getCurrentLanguage() {
        return this.currentLanguage;
    }
}

window.languageManager = new LanguageManager();

window.t = function(key, params = {}) {
    return window.languageManager.t(key, params);
};

window.setLanguage = function(lang) {
    return window.languageManager.setLanguage(lang);
};

// Обновляем язык сразу при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    // Обновляем селектор языка
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.value = window.languageManager.getCurrentLanguage();
        
        languageSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            window.setLanguage(lang);
        });
    }
    
    // Обновляем интерфейс входа сразу
    setTimeout(() => {
        window.languageManager.updateLoginModal();
    }, 50);
});