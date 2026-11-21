export const SERVICE_NAMES = {sharednai: 'SharedNAI', sakura: 'Sakura NAI', custom: '사용자 지정'};
export function profileTitle(p = {}) {
    const service = SERVICE_NAMES[p.preset] ?? '연결';
    const label = String(p.label || '').trim();
    const kind = p.api === 'sdapi' ? 'sdapi' : '';
    return {title: label || service, detail: [service === label ? '' : service, kind].filter(Boolean).join(' · ')};
}
const num = (value, unit = '') => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR') + unit : '정보 없음';
const TIERS = {0: 'Free', 1: 'Tablet', 2: 'Scroll', 3: 'Opus'};
function when(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    return new Date(value < 1e11 ? value * 1000 : value).toLocaleString('ko-KR');
}
function sharedRows(a) {
    const rows = [
        ['계정 크레딧', num(a.anlas_balance, ' Anlas')],
        ['공식 계정 크레딧', num(a.official_anlas_balance, ' Anlas')],
        ['공유 계정 사용 가능 크레딧', num(a.shared_available_anlas_balance ?? a.shared_anlas_balance, ' Anlas')],
        ['요금제', a.tier_name || '정보 없음'],
    ];
    if (a.uses_official_token !== true) {
        rows.push(['V5 남은 할당량', a.is_trial_vip === true ? num(a.trial_v5_quota, '장 (체험)') : num(a.v5_remaining_images, '장')]);
        if (a.is_trial_vip !== true) rows.push(['V5 최대 할당량', num(a.v5_max_images, '장')], ['V5 에너지', num(a.v5_energy_percent, '%')], ['V5 일일 보충량', num(a.v5_daily_refill_images, '장')]);
    }
    if (a.expires_at) rows.push(['계정 만료', a.expires_at]);
    return rows;
}
function novelRows(a) {
    const rows = [
        ['구독 상태', a.active === true ? '활성' : a.active === false ? '비활성' : '정보 없음'],
        ['구독 등급', Number.isFinite(a.tier) ? (TIERS[a.tier] ?? `등급 ${a.tier}`) : '정보 없음'],
        ['Anlas', num(a.anlas, ' Anlas')],
        ['사용량', num(a.usagePercent, '%')],
    ];
    const end = when(a.expiresAt);
    if (end) rows.push(['구독 만료', end]);
    return rows;
}
// account = {kind, data} as returned by the server plugin. Returns [] when the service provides nothing.
export function accountRows(account = {}, profile = {}) {
    if (profile.api === 'sdapi') return [];
    const data = account?.data ?? {};
    return account?.kind === 'sharednai' ? sharedRows(data) : novelRows(data);
}
