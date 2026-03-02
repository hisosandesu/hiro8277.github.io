export const MESSAGES = {
  ERROR: {
    TITLE: "エラー",
    CAMERA_PERMISSION: "カメラ権限がありません。",
    CAMERA_LAUNCH: "カメラの起動に失敗しました",
    OCR_FAILED: "テキスト認識に失敗しました",
    HIGH_PRECISION_FAILED: "Cloud Vision APIでの高精度認識に失敗しました",
    NO_TEXT: "保存するテキストがありません",
    SAVE_FAILED: "履歴の保存に失敗しました",
    LOAD_FAILED: "履歴の読み込みに失敗しました",
    DELETE_FAILED: "履歴の削除に失敗しました",
  },
  SUCCESS: {
    SAVE_TITLE: "保存完了",
    SAVE_BODY: "テキストを履歴に保存しました",
    COPY_TITLE: "コピー完了",
    COPY_BODY: "テキストをクリップボードにコピーしました",
  },
  CONFIRM: {
    DELETE_ALL_TITLE: "確認",
    DELETE_ALL_BODY: "すべての履歴を削除しますか？",
    CANCEL: "キャンセル",
    DELETE: "削除",
  },
  INFO: {
    TEXT_TRUNCATED_TITLE: "テキストを省略しました",
    TEXT_TRUNCATED_BODY: "認識テキストが長すぎるため、先頭部分のみ表示されます",
  },
};
