import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced, getRequestHeaders } from '../../../../script.js';
import { SECRET_KEYS, secret_state } from '../../../secrets.js';
import { installTransport } from './transport.mjs';
import { accountRows, profileTitle } from './display.mjs';

const ID = 'nai_connection_hub', API = '/api/plugins/nai-connection-hub';
extension_settings[ID] ??= {enabled: false};
const settings = extension_settings[ID];
let status = {connected: false, active: null, profiles: []};
let previousNovelState, ownsGate = false, container, accountVersion = 0, refreshTimer;
const el = id => container?.querySelector('#nch-' + id);
const show = message => { if (el('status')) el('status').textContent = message; };
const fail = error => {
    const message = error?.message || String(error);
    show(message); console.error('[NAI 통합 연결]', error);
    try { window.toastr?.error(message, 'NAI 통합 연결'); } catch { /* optional */ }
};
const isConnected = () => status.connected === true;
const activeProfile = () => status.profiles.find(p => p.id === status.active);

function updateGate() {
    if (settings.enabled && isConnected() && !ownsGate) {
        previousNovelState = secret_state[SECRET_KEYS.NOVEL]; secret_state[SECRET_KEYS.NOVEL] = true; ownsGate = true;
    } else if ((!settings.enabled || !isConnected()) && ownsGate) {
        secret_state[SECRET_KEYS.NOVEL] = previousNovelState; ownsGate = false;
    }
}
function clearAccount(message) {
    accountVersion++;
    el('account')?.replaceChildren();
    if (el('account-status')) el('account-status').textContent = message;
}
function renderProfiles() {
    const list = el('profiles');
    if (!list) return;
    list.replaceChildren();
    for (const p of status.profiles) {
        const li = document.createElement('li'), name = document.createElement('div'), title = document.createElement('span'), small = document.createElement('small');
        const {title: text, detail} = profileTitle(p);
        li.className = 'nch-profile' + (p.id === status.active ? ' nch-active' : '');
        name.className = 'nch-profile-name'; title.textContent = text; small.textContent = detail + (p.remembered ? (detail ? ' · ' : '') + '저장됨' : '');
        name.append(title, small); li.append(name);
        if (p.id === status.active) {
            const badge = document.createElement('span'); badge.className = 'nch-badge'; badge.textContent = '사용 중'; li.append(badge);
        } else {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'menu_button'; button.dataset.select = p.id; button.textContent = '연결 전환'; li.append(button);
        }
        list.append(li);
    }
    el('profiles-empty').hidden = status.profiles.length > 0;
    const current = activeProfile();
    el('remember-current').checked = !!current?.remembered;
    el('remember-current').disabled = !current;
    el('check').disabled = !current;
    el('disconnect').disabled = !current;
}
function applyStatus(next) {
    status = {connected: next?.connected === true, active: next?.active ?? null, profiles: Array.isArray(next?.profiles) ? next.profiles : []};
    updateGate(); renderProfiles();
    if (!isConnected()) clearAccount('연결 후 표시됩니다.');
}
async function api(path, body) {
    const response = await fetch(API + path, {method: body === undefined ? 'GET' : 'POST', headers: getRequestHeaders(), ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    if (!response.ok) {
        let message = response.status === 404 ? 'NAI 통합 연결 서버 플러그인(nai-connection-hub)을 설치하고 enableServerPlugins를 켠 뒤 서버를 재시작하세요.' : `HTTP ${response.status}`;
        try { message = (await response.json()).message || message; } catch { /* HTML errors */ }
        if (response.status === 401 && path !== '/status') void syncStatus();
        throw new Error(message);
    }
    return response;
}
async function syncStatus() {
    try { applyStatus(await (await api('/status')).json()); }
    catch (error) { applyStatus(null); show(error.message); }
}
async function refreshAccount() {
    if (!container || !isConnected()) return;
    const version = ++accountVersion;
    el('account-status').textContent = '계정 정보 조회 중…';
    try {
        const data = await (await api('/account')).json();
        if (version !== accountVersion || !isConnected()) return;
        const rows = accountRows(data.account, activeProfile());
        el('account').replaceChildren();
        for (const [label, value] of rows) {
            const dt = document.createElement('dt'), dd = document.createElement('dd');
            dt.textContent = label; dd.textContent = value; el('account').append(dt, dd);
        }
        el('account-status').textContent = rows.length ? `조회 시각: ${new Date().toLocaleString('ko-KR')}` : '이 연결은 크레딧·할당량 정보를 제공하지 않습니다.';
    } catch (error) {
        if (version !== accountVersion) return;
        el('account').replaceChildren(); el('account-status').textContent = error.message;
    }
}
function setBusy(busy) {
    for (const button of container.querySelectorAll('button')) button.disabled = busy;
    if (!busy) renderProfiles();
}
function updateServiceFields() {
    const service = el('service').value;
    const visible = {sharednai: ['sharednai'], sakura: ['key'], custom: ['custom', 'key']}[service] ?? [];
    for (const node of container.querySelectorAll('[data-group]')) node.hidden = !visible.includes(node.dataset.group);
}
function connectBody() {
    const service = el('service').value, remember = el('remember').checked;
    if (service === 'sharednai') {
        if (!el('username').value.trim() || !el('password').value) throw new Error('사이트 아이디와 비밀번호를 입력하세요.');
        return {preset: 'sharednai', username: el('username').value, password: el('password').value, remember};
    }
    if (!el('key').value.trim()) throw new Error('사이트 키(토큰)를 입력하세요.');
    if (service === 'sakura') return {preset: 'sakura', key: el('key').value, remember};
    if (!el('baseurl').value.trim()) throw new Error('API 기본 주소를 입력하세요.');
    return {preset: 'custom', baseUrl: el('baseurl').value.trim(), label: el('label').value.trim(), key: el('key').value, remember};
}

// Install before AutoPic to retain its injected characters and reference fields.
installTransport(window, () => settings.enabled, API + '/generate', code => {
    if (code === 401) { void syncStatus(); return; }
    clearTimeout(refreshTimer); refreshTimer = setTimeout(() => void refreshAccount(), 800);
});
jQuery(async () => {
    const response = await fetch(new URL('./settings.html', import.meta.url));
    container = document.createElement('div'); container.innerHTML = await response.text();
    document.querySelector('#extensions_settings').append(container);
    el('enabled').checked = !!settings.enabled;
    el('enabled').addEventListener('change', () => { settings.enabled = el('enabled').checked; saveSettingsDebounced(); updateGate(); });
    el('service').addEventListener('change', updateServiceFields);
    updateServiceFields();
    el('profiles').addEventListener('click', async event => {
        const id = event.target.closest?.('button[data-select]')?.dataset.select;
        if (!id) return;
        setBusy(true); show('연결 전환 중…'); clearAccount('계정 연결 중…');
        try {
            applyStatus(await (await api('/select', {id})).json());
            settings.enabled = true; el('enabled').checked = true; saveSettingsDebounced(); updateGate();
            show(`${profileTitle(activeProfile()).title}로 전환했습니다.`);
        } catch (error) { await syncStatus(); fail(error); }
        finally { setBusy(false); }
        await refreshAccount();
    });
    el('connect').addEventListener('click', async () => {
        let body;
        try { body = connectBody(); } catch (error) { fail(error); return; }
        setBusy(true); show('연결 확인 중…'); clearAccount('계정 연결 중…');
        try {
            applyStatus(await (await api('/connect', body)).json());
            el('password').value = ''; el('key').value = '';
            settings.enabled = true; el('enabled').checked = true; saveSettingsDebounced(); updateGate();
            show(`${profileTitle(activeProfile()).title} 연결되었습니다.`);
        } catch (error) { await syncStatus(); fail(error); }
        finally { setBusy(false); }
        await refreshAccount();
    });
    el('check').addEventListener('click', async () => {
        setBusy(true);
        try { await api('/check', {}); show('인증 정상'); } catch (error) { await syncStatus(); fail(error); }
        finally { setBusy(false); }
        await refreshAccount();
    });
    el('refresh').addEventListener('click', () => { if (!isConnected()) show('먼저 서비스를 연결하세요.'); else void refreshAccount(); });
    el('disconnect').addEventListener('click', async () => {
        setBusy(true);
        try { applyStatus(await (await api('/disconnect', {})).json()); show('현재 연결을 삭제했습니다. 다른 등록된 연결은 유지됩니다.'); }
        catch (error) { show(error.message); }
        finally { setBusy(false); }
    });
    el('remember-current').addEventListener('change', async () => {
        const remember = el('remember-current').checked;
        setBusy(true);
        try { await api('/remember', {remember}); show(remember ? '현재 연결을 저장했습니다.' : '저장된 키·토큰을 삭제했습니다. 현재 연결은 서버 종료까지 유지됩니다.'); }
        catch (error) { show(error.message); }
        finally { await syncStatus(); setBusy(false); }
    });
    await syncStatus();
    show(isConnected() ? `${profileTitle(activeProfile()).title} 연결됨` : '서비스를 연결하세요.');
    await refreshAccount();
});
