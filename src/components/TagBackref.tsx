import { useMemo } from 'react';
import { useStore } from '../store';
import { collectTagInfo } from '../utils';

export default function TagBackref({ onClose }: { onClose: () => void }) {
  const library = useStore((s) => s.library);
  const project = useStore((s) => s.project);
  const selectEntity = useStore((s) => s.selectEntity);
  const setRightTab = useStore((s) => s.setRightTab);

  const info = useMemo(() => collectTagInfo(library, project), [library, project]);
  const onlyUsed = info.filter((t) => t.uses.length > 0);

  const open = (id: string) => {
    selectEntity(id);
    setRightTab('template');
    onClose();
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal panel hand-border" onClick={(e) => e.stopPropagation()} style={{ width: 640, maxHeight: '80vh', overflow: 'auto' }}>
        <div className="modal-head">
          <h3>标签反查（双向）</h3>
          <button className="hp-btn" onClick={onClose}>关闭</button>
        </div>
        <p className="muted">
          查看每个标签被谁当「权限 / 门槛 / 筛选」使用，以及哪些组件自带该标签（可点击定位去编辑）。
          未被任何组件自带、却出现在 gate/筛选里的标签，就是潜在「能力真空」（见清单 K2）。
        </p>
        {onlyUsed.length === 0 && <p className="muted">当前没有任何标签被用作权限 / 门槛 / 筛选。</p>}
        {onlyUsed.map((t) => (
          <div key={t.tag} className="tag-backref">
            <div className="tag-backref-head">
              <span className="tag on">{t.tag}</span>
              {t.uses.length > 0 && <span className="muted">被 {t.uses.length} 处引用</span>}
            </div>
            <div className="tag-backref-uses">
              {t.uses.map((u, i) => (
                <span key={i} className="badge soft">
                  {u.type}：<a onClick={() => open(u.ref)}>{u.name}</a>
                </span>
              ))}
            </div>
            {t.owners.length > 0 ? (
              <div className="tag-backref-owners">
                <span className="muted">可由（提供能力）：</span>
                {t.owners.map((o) => (
                  <span key={o.ref} className={`badge ${o.enabled ? 'on' : 'off'}`} onClick={() => open(o.ref)} style={{ cursor: 'pointer' }}>
                    {o.name}{o.enabled ? '' : '（未启用）'}
                  </span>
                ))}
              </div>
            ) : (
              <div className="tag-backref-owners warn">⚠ 没有任何组件自带此标签——无法被满足</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
