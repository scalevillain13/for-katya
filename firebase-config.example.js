/**
 * Скопируй этот файл в firebase-config.js и вставь данные из Firebase Console.
 * Инструкция: WATCH_ROOM_SETUP.md
 */
const FIREBASE_CONFIG = {
  apiKey: "ВСТАВЬ_API_KEY",
  authDomain: "ВСТАВЬ.firebaseapp.com",
  databaseURL: "https://ВСТАВЬ-default-rtdb.firebaseio.com",
  projectId: "ВСТАВЬ",
  storageBucket: "ВСТАВЬ.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
};

/** Секретный код комнаты — только вы двое должны его знать */
const WATCH_ROOM_DEFAULT = {
  roomId: "bulka-katya-room",
  /** Имя по умолчанию для тебя (она вводит своё при входе) */
  yourDefaultName: "",
};
