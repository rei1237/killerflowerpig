// 변이(챔피언/엘리트 능력)와 보물 상자 난수 스트림을 고정한다. 두 스트림은 Math.random 과 분리돼 있어
// 시드 기반 벤치마크(tools/run-progression-audit.mjs)의 시드로는 재현되지 않으므로, 재현이 필요한 테스트는 이 파일을 먼저 import 한다.
// 픽스처 재생성: node --import ./tests/helpers/fixed-variants.mjs tools/run-progression-audit.mjs --fixtures > tests/fixtures/planned-boss-builds.json
import { affixRandom } from '../../src/game/affixes.js';
import { treasureRandom } from '../../src/game/coin-drops.js';
affixRandom.next = () => .99;    // 챔피언 없음, 엘리트 능력은 항상 같은 조합 (상태 없는 스텁이라 호출 순서와 무관)
treasureRandom.next = () => .99; // 보물 상자 없음 (대량 처치 시뮬레이션에서 픽업이 섞이지 않게)
