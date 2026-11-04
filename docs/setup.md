# 연결 설정

노션 원본 DB에서 참여 기록을 읽고, README와 참여자별 SVG 잔디를 갱신합니다.

## 노션 연결

1. 노션에서 읽기 권한을 가진 내부 연결을 생성합니다.
2. 원본 문제 DB를 해당 연결에 공유합니다.
3. GitHub 저장소 Settings → Secrets and variables → Actions에 `NOTION_TOKEN`을 등록합니다.
4. Actions의 **Update participation README**를 수동 실행합니다.

이후 매시 17분과 47분에 동기화를 시도합니다. 예약 실행에는 지연이 발생할 수 있습니다. 동기화 실패 시 갱신을 중단해 마지막 정상 기록을 보존합니다. 토큰 등록 전에는 기존 데이터로 잔디를 생성하며, 기록 동기화 시각은 유지합니다.

공개 데이터에는 닉네임, 문제 제목, 문제 링크, 유형, 날짜, 참여 정보가 들어갑니다. 페이지 본문과 이메일은 수집하지 않습니다. 참여자 식별자는 노션 ID의 해시를 사용하고, 표시 이름은 `data/names.json`에서 지정할 수 있습니다.

## 로컬 실행

Node.js 22 이상을 사용합니다. 패키지 설치는 필요 없습니다.

```sh
npm test
npm run render
```

`npm run sync`는 `NOTION_TOKEN`과 `NOTION_DATA_SOURCE_ID` 환경변수를 사용합니다.

개인별 실제 풀이 날짜가 필요하면 원본 DB에 별도 풀이 기록이 필요합니다.
