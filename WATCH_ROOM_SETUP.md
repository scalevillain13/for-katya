# Комната «Смотрим вместе» — настройка Firebase

Чтобы YouTube и чат работали **в реальном времени**, нужен бесплатный аккаунт Firebase (~10 минут, один раз).

---

## Что нужно с твоей стороны

1. **Google-аккаунт** (любой Gmail)
2. **~10 минут** на настройку Firebase
3. **Вставить ключи** в файл `firebase-config.js`
4. **Задать секретный код комнаты** (чтобы посторонние не зашли)
5. **Задеплоить** (`git push`) — как обычно

YouTube API ключ **не нужен** — только ссылки на видео.

---

## Шаг 1: Создай проект Firebase

1. Открой https://console.firebase.google.com/
2. **Add project** / «Создать проект»
3. Название: например `for-katya-watch`
4. Google Analytics — можно **выключить**
5. Создай проект

---

## Шаг 2: Realtime Database

1. В меню слева: **Build → Realtime Database**
2. **Create Database**
3. Регион: **europe-west1** (или ближайший к вам)
4. Сначала выбери **Start in test mode** (потом заменим правила)
5. Скопируй URL базы — он вида:
   `https://XXXX-default-rtdb.europe-west1.firebasedatabase.app`

---

## Шаг 3: Правила безопасности

1. Вкладка **Rules** в Realtime Database
2. Замени содержимое на код из файла [`database.rules.json`](database.rules.json) в этом проекте
3. Нажми **Publish**

> Комната защищена **секретным кодом** в URL/форме входа. Не публикуй код комнаты в открытом доступе.

---

## Шаг 4: Web-приложение и ключи

1. Настройки проекта (шестерёнка) → **Project settings**
2. Прокрути до **Your apps** → иконка **`</>`** (Web)
3. Nickname: `for-katya`
4. **Register app**
5. Скопируй объект `firebaseConfig` — он выглядит так:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "for-katya-watch.firebaseapp.com",
  databaseURL: "https://for-katya-watch-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "for-katya-watch",
  storageBucket: "for-katya-watch.appspot.com",
  messagingSenderId: "...",
  appId: "1:...:web:..."
};
```

---

## Шаг 5: Вставь ключи в проект

Открой файл **`firebase-config.js`** и замени все `ВСТАВЬ...` на свои значения:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "...",
  databaseURL: "https://...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};

const WATCH_ROOM_DEFAULT = {
  roomId: "bulka-katya-room",  // придумай свой секретный код
  yourDefaultName: "Твоё имя", // как тебя видно в чате
};
```

**`roomId`** — секретное имя комнаты. Только вы двое его знаете.

**`yourDefaultName`** — твоё имя в чате (она вводит своё при входе).

---

## Шаг 6: Деплой

```bash
git add firebase-config.js watch.html watch.js watch.css database.rules.json WATCH_ROOM_SETUP.md
git commit -m "Configure watch room"
git push
```

Через 1–2 минуты комната будет доступна:

**https://scalevillain13.github.io/for-katya/watch.html**

---

## Как пользоваться

1. Ты открываешь комнату, вставляешь ссылку на YouTube, жмёшь **«Открыть»**
2. Кидаешь ей ссылку (можно с параметрами):
   `https://scalevillain13.github.io/for-katya/watch.html?room=bulka-katya-room`
3. Она вводит имя **Катя** и тот же код комнаты
4. Play/pause и перемотка синхронизируются
5. Чат справа (на телефоне — снизу)

---

## Лимиты (бесплатно)

Firebase Spark (free) для двух человек более чем достаточно.

---

## Если что-то не работает

- Проверь, что в `firebase-config.js` нет текста `ВСТАВЬ`
- Проверь **Rules** опубликованы
- YouTube: некоторые видео **запрещают встраивание** — попробуй другое
- Открывай комнату в **Chrome / Safari**, не во встроенном браузере Telegram
