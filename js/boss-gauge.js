import { isPhaseArtRevealed } from './phase-art.js';
import { esc, safeColor } from './utils.js';

const lastPhaseOneHp = new Map();

function gaugeKey(battle) {
  const enemy = battle?.enemy;
  return `${battle?.mode || 'battle'}:${battle?.startedAt || 0}:${enemy?.defId || enemy?.name || 'none'}`;
}

/**
 * 二阶段首领的两条命。引擎里的 hp 是一条总血槽：
 * 前 H-T 点属于第一阶段，后 T 点属于第二阶段。
 * 这里只做显示分池，不改动任何结算。
 */
export function bossPhasePools(enemy) {
  const maxHp = Math.max(1, Math.round(Number(enemy?.maxHp) || 1));
  const hp = Math.max(0, Math.min(maxHp, Math.round(Number(enemy?.hp) || 0)));
  const phase2 = enemy?.phase2;
  if (!phase2) return null;
  const ratio = Math.min(0.95, Math.max(0.05, Number(phase2.at) || 0.5));
  const threshold = Math.max(1, Math.min(maxHp, Math.ceil(maxHp * ratio)));
  const phase1Max = Math.max(0, maxHp - threshold);
  return {
    total: maxHp,
    threshold,
    phase1: {
      max: phase1Max,
      hp: Math.max(0, Math.min(phase1Max, hp - threshold)),
    },
    phase2: {
      max: threshold,
      hp: Math.max(0, Math.min(threshold, hp)),
    },
  };
}

function percent(value, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function bossGaugeMarkup(battle, options = {}) {
  const enemy = battle?.enemy;
  const pools = bossPhasePools(enemy);
  if (!pools || pools.phase1.max <= 0) return '';
  const awake = isPhaseArtRevealed(battle);
  const key = gaugeKey(battle);

  // 转阶段的那一帧里第一阶段已经归零，但演出需要一个可见的「最后一滴」。
  // 记住上一次渲染时的血量，让假死条从它该在的位置开始往下掉。
  let phase1Hp = pools.phase1.hp;
  if (!awake) {
    if (phase1Hp > 0) {
      lastPhaseOneHp.set(key, phase1Hp);
    } else if (lastPhaseOneHp.has(key)) {
      phase1Hp = lastPhaseOneHp.get(key);
    }
  }
  phase1Hp = Math.max(0, Math.min(pools.phase1.max, phase1Hp));

  const phase1Pct = percent(phase1Hp, pools.phase1.max);
  const phase2Pct = percent(pools.phase2.hp, pools.phase2.max);
  const title = enemy?.phaseTitle || enemy?.phase2?.title || '真形';
  const color = safeColor(enemy?.phase2?.color || enemy?.accent || '#d06a60');
  const className = options.className ? ` ${options.className}` : '';

  return `<div class="boss-gauge ${awake ? 'is-open' : ''}${className}" data-boss-gauge style="--phase-color:${color};--phase1-pct:${phase1Pct.toFixed(2)}%">
    <span class="boss-gauge__halo" aria-hidden="true"></span>
    <div class="boss-gauge__stage boss-gauge__stage--one ${awake ? 'is-broken' : ''}">
      <div class="boss-gauge__meta">
        <span class="boss-gauge__name"><b>I</b><span>梦壳</span></span>
        <span class="boss-gauge__value"><strong data-boss-hp>${Math.round(phase1Hp)}</strong><small>/ ${pools.phase1.max}</small></span>
      </div>
      <span class="boss-gauge__track" role="progressbar" aria-label="第一阶段生命" aria-valuemin="0" aria-valuemax="${pools.phase1.max}" aria-valuenow="${Math.round(phase1Hp)}">
        <i class="boss-gauge__fill" style="width:${phase1Pct.toFixed(2)}%"></i>
        <span class="boss-gauge__sheen" aria-hidden="true"></span>
        <span class="boss-gauge__broken-mark" aria-hidden="true">碎</span>
      </span>
    </div>
    <div class="boss-gauge__stage boss-gauge__stage--two">
      <div class="boss-gauge__meta">
        <span class="boss-gauge__name"><b>II</b><span>${esc(title)}</span></span>
        <span class="boss-gauge__value"><strong data-boss-hp>${pools.phase2.hp}</strong><small>/ ${pools.phase2.max}</small></span>
      </div>
      <span class="boss-gauge__track" role="progressbar" aria-label="第二阶段生命" aria-valuemin="0" aria-valuemax="${pools.phase2.max}" aria-valuenow="${pools.phase2.hp}">
        <i class="boss-gauge__fill" style="width:${awake ? phase2Pct.toFixed(2) : '0'}%"></i>
        <span class="boss-gauge__sheen" aria-hidden="true"></span>
      </span>
    </div>
  </div>`;
}
