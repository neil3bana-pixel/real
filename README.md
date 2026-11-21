# 000 NAI 통합 연결 (화면 확장) 1.0.1

서버 플러그인 `nai-connection-hub`(1.0.1 이상)와 함께 쓰는 화면 확장입니다.

- 설치 위치: `SillyTavern/data/default-user/extensions/nai-connection-hub/`
- GitHub에 올릴 때는 이 폴더 **안의 파일**을 저장소 최상위에 올립니다. (`manifest.json`이 최상위에 있어야 함)
- 확장 이름의 `000`과 로딩 순서(-1000)는 AutoPic 요청 변환에 필요하므로 바꾸지 마세요.
- 기존 "SharedNAI 연결"(kk) 확장과 동시에 켜지 마세요. 기존 확장은 끄거나 삭제하세요.
- 서비스: SharedNAI(아이디·비밀번호) / Sakura NAI(키) / 다른 서버(NovelAI 호환, 주소가 `/sdapi/v1`로 끝나면 sdapi 방식)
