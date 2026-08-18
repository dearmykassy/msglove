const OFFICIAL_ADMINISTRATIVE_SUFFIX = /(특별자치도|특별자치시|특별시|광역시|도|시)$/u;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const ADMINISTRATIVE_NAME_FOLLOW =
  /(?=$|\s|[.,!?·:;()[\]{}'"/\-]|출장마사지|출장안마|출장타이마사지|출장스웨디시|출장홈타이|토닥이|남성전용마사지|여성전용마사지|은|는|이|가|을|를|에|에서|의|와|과|로|으로|까지|부터|처럼|마다|보다|도|만|께서|에게|한테)/u;

/** Strip only a known official administrative token, never an arbitrary place name. */
export function shortenOfficialAdministrativeName(value: string): string {
  return value.normalize("NFC").trim().replace(OFFICIAL_ADMINISTRATIVE_SUFFIX, "");
}

export function createKnownAdministrativeNameShortener(
  officialNames: readonly string[],
): (value: string) => string {
  const replacements = [...new Set(officialNames.map((name) => name.normalize("NFC").trim()))]
    .map((official) => [official, shortenOfficialAdministrativeName(official)] as const)
    .filter(([official, concise]) => concise && concise !== official)
    .sort(([left], [right]) => right.length - left.length);

  return (value: string) => {
    let result = value.normalize("NFC");
    for (const [official, concise] of replacements) {
      const boundary = ADMINISTRATIVE_NAME_FOLLOW.source;
      result = result.replace(
        new RegExp(`${escapeRegExp(official)}${boundary}`, "gu"),
        concise,
      );
    }
    for (const [, concise] of replacements) {
      result = result.replace(
        new RegExp(`${escapeRegExp(concise)}\\s+${escapeRegExp(concise)}(?=[가-힣0-9])`, "gu"),
        concise,
      );
    }
    return result;
  };
}
