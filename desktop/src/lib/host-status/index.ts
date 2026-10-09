// Единственное место знания о хостах: health-карта data-plane роутинга (30s cooldown),
// вердикты main/star/net + incident-state, probe-движок, выбор control-plane базы.
// Вердикт меняют только активные пробы и реальные успехи; пассивные фейлы лишь планируют пробу.
// Отдельно от вердиктов живёт деградация main — «отвечает `/health`, но не обслуживает».
export {
  isMainDegraded,
  markMainDegraded,
  noteMainBadResponse,
  SLOW_RESPONSE_MS,
  subscribeMainDegraded,
} from './degraded';
export {
  initHostStatus,
  isHealthy,
  isTimeoutError,
  markHealthy,
  markUnhealthy,
  noteMainAlive,
  noteRequestTimeout,
  noteUnreachable,
  requestProbe,
} from './probe';
export {
  type FailoverUi,
  getHostVerdict,
  type HostStatusState,
  type HostVerdict,
  isIncidentActive,
  type NetVerdict,
  preferredControlBase,
  type RemoteVerdict,
  selectFailoverUi,
  useHostStatusStore,
} from './store';
