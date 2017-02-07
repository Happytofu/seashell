export interface CoderEncrypted {
  iv: ArrayBuffer,
  tag: ArrayBuffer,
  encrypted: ArrayBuffer,
}
export class Coder {
  key: CryptoKey;
  rawKey: Uint8Array;
  constructor(rawKey: Uint8Array) {
    this.rawKey = rawKey;
  }
  init = () => {
    return window.crypto.subtle.importKey(
      "raw",
      this.rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"])
      .then((key) => {
        this.key = key;
      })
  }
  encrypt = (data: ArrayBuffer) : PromiseLike<CoderEncrypted> => {
    let iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);
    return window.crypto.subtle.encrypt({
      name: "AES-GCM",
      iv: iv,
      additionalData: iv,
      tagLength: 128
    }, this.key, data)
    .then((encrypted_tag) => {
      let encrypted = encrypted_tag.slice(0, encrypted_tag.byteLength - 8);
      let tag = encrypted_tag.slice(encrypted_tag.byteLength - 8);
      return {
        iv: new Uint8Array(iv).buffer,
        encrypted: new Uint8Array(encrypted).buffer,
        tag: new Uint8Array(tag).buffer,
      };
    });
  }
  decrypt = (encryptionResult: CoderEncrypted) => {
    let iv = encryptionResult.iv;
    let encrypted = encryptionResult.encrypted;
    let tag = encryptionResult.tag;
    let data = new Uint8Array(encrypted.byteLength + tag.byteLength);
    data.set(new Uint8Array(encrypted), 0);
    data.set(new Uint8Array(tag), encrypted.byteLength);
    return window.crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: iv,
      additionalData: iv,
      tagLength: 128,
    }, this.key, data);
  }
}