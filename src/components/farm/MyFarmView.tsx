import React, { useState, useEffect } from 'react';
import type { Language, LocationContext, Farm, FarmPlot } from '../../types';
import { translations } from '../../i18n/translations';
import { FarmService } from '../../services/farm/farmService';
import { PlanCropWizard } from './PlanCropWizard';
import { 
  MapPin, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  AlertOctagon, 
  Droplet, 
  Stethoscope,
  Sprout
} from 'lucide-react';

interface MyFarmViewProps {
  currentLang: Language;
  location: LocationContext;
  onNavigateToCropDoctor: () => void;
}

export const MyFarmView: React.FC<MyFarmViewProps> = ({
  currentLang,
  location,
  onNavigateToCropDoctor,
}) => {
  const t = translations[currentLang];
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showPlanWizard, setShowPlanWizard] = useState<boolean>(false);

  const loadFarms = async () => {
    setLoading(true);
    try {
      const farmList = await FarmService.getFarms();
      setFarms(farmList);
      if (farmList.length > 0) {
        // Keep current selected if valid, otherwise select first
        setSelectedFarmId(prev => {
          if (prev && farmList.some(f => f.id === prev)) return prev;
          return farmList[0].id;
        });
      } else {
        setSelectedFarmId('');
      }
    } catch (err) {
      console.warn('[MyFarmView] Error loading farms:', err);
      setFarms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFarms();
  }, []);

  const activeFarm = farms.find(f => f.id === selectedFarmId) || farms[0];

  const getStatusBadge = (status: FarmPlot['status']) => {
    switch (status) {
      case 'healthy':
        return {
          label: t.statusHealthy || 'Healthy',
          icon: <CheckCircle size={13} />,
          bg: 'var(--ag-color-primary-light)',
          color: 'var(--ag-color-primary-dark)',
          border: '1px solid #A3D9A5',
        };
      case 'under_watch':
        return {
          label: t.statusUnderWatch || 'Under Watch',
          icon: <AlertTriangle size={13} />,
          bg: 'var(--ag-color-harvest-light)',
          color: 'var(--ag-color-warning-base)',
          border: '1px solid #FAD48C',
        };
      case 'attention':
      default:
        return {
          label: t.statusAttention || 'Needs Action',
          icon: <AlertOctagon size={13} />,
          bg: '#FDF0F0',
          color: 'var(--ag-color-danger-base)',
          border: '1px solid #F7B5B3',
        };
    }
  };

  return (
    <div style={{
      maxWidth: '1240px',
      margin: '0 auto',
      padding: '20px 16px 40px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {/* Top Banner & Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ag-color-primary-base)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Agricultural Management
            </span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ag-color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            {t.myFarmTitle || 'My Farm'}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--ag-color-text-secondary)', margin: '4px 0 0 0' }}>
            {t.myFarmSubtitle || 'Manage your farms, monitor active crop plots, and plan upcoming seasons.'}
          </p>
        </div>

        {/* Primary CTA (Only Plan a Crop, no separate Add Farm button) */}
        {farms.length > 0 && (
          <button
            onClick={() => setShowPlanWizard(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--ag-color-primary-base)',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 22px',
              borderRadius: 'var(--ag-radius-full)',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              minHeight: '48px',
              boxShadow: 'var(--ag-shadow-button)',
            }}
          >
            <Sparkles size={18} />
            <span>{t.planCropBtn || 'Plan a Crop'}</span>
          </button>
        )}
      </div>

      {/* Loading state feedback */}
      {loading && (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: 'var(--ag-color-surface-base)',
          borderRadius: 'var(--ag-radius-card)',
          border: '1px solid var(--ag-border-default)',
          color: 'var(--ag-color-text-secondary)',
          fontSize: '14px',
          fontWeight: 600,
        }}>
          Loading your verified farm records...
        </div>
      )}

      {/* Genuine Empty State: No farm added yet */}
      {!loading && farms.length === 0 && (
        <div style={{
          backgroundColor: 'var(--ag-color-surface-base)',
          borderRadius: '20px',
          border: '1px dashed var(--ag-border-default)',
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--ag-color-primary-light)',
            color: 'var(--ag-color-primary-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sprout size={32} />
          </div>

          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ag-color-text-primary)', margin: '0 0 6px 0' }}>
              {t.noFarmAddedYet}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--ag-color-text-secondary)', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
              {t.tellAgriGuideHelper}
            </p>
          </div>

          <button
            onClick={() => setShowPlanWizard(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--ag-color-primary-base)',
              color: '#FFFFFF',
              border: 'none',
              padding: '14px 28px',
              borderRadius: 'var(--ag-radius-full)',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              minHeight: '48px',
              boxShadow: 'var(--ag-shadow-button)',
              marginTop: '8px',
            }}
          >
            <Sparkles size={18} />
            <span>{t.planFirstCrop}</span>
          </button>
        </div>
      )}

      {/* Multiple Farms Selector Pills */}
      {!loading && farms.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {farms.map((f) => {
            const isSelected = f.id === activeFarm?.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFarmId(f.id)}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--ag-radius-full)',
                  border: isSelected ? '2px solid var(--ag-color-primary-base)' : '1px solid var(--ag-border-default)',
                  backgroundColor: isSelected ? 'var(--ag-color-primary-light)' : 'var(--ag-color-surface-base)',
                  color: isSelected ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-text-primary)',
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🌾 {f.farmName} ({f.totalAcres} ac)
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Farm Card Header */}
      {!loading && activeFarm && (
        <div style={{
          backgroundColor: 'var(--ag-color-surface-base)',
          borderRadius: 'var(--ag-radius-card)',
          border: '1px solid var(--ag-border-default)',
          padding: '20px',
          boxShadow: 'var(--ag-shadow-card)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ag-color-text-primary)', margin: 0 }}>
                {activeFarm.farmName}
              </h3>
              <span style={{
                backgroundColor: 'var(--ag-color-primary-light)',
                color: 'var(--ag-color-primary-dark)',
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--ag-radius-full)',
              }}>
                {activeFarm.totalAcres} Acres Total
              </span>
              {activeFarm.availableAcres !== undefined && (
                <span style={{
                  backgroundColor: activeFarm.availableAcres > 0 ? '#FAFBF7' : '#FDF0F0',
                  color: activeFarm.availableAcres > 0 ? 'var(--ag-color-text-secondary)' : 'var(--ag-color-danger-base)',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--ag-radius-full)',
                  border: '1px solid var(--ag-border-default)',
                }}>
                  {activeFarm.availableAcres.toFixed(1)} ac unallocated
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: 'var(--ag-color-text-secondary)', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={13} color="var(--ag-color-primary-base)" />
                {activeFarm.village ? `${activeFarm.village}, ` : ''}{activeFarm.district}, {activeFarm.state}
              </span>
              <span>·</span>
              <span>🌱 {activeFarm.soilType}</span>
              <span>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Droplet size={13} color="#0284C7" />
                {activeFarm.irrigationSource}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', textAlign: 'right' }}>
            <div>
              <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ag-color-primary-base)', display: 'block' }}>
                {activeFarm.plots.length}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase' }}>
                {t.plotsHeading}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ag-color-primary-dark)', display: 'block' }}>
                {activeFarm.cropsCount || activeFarm.cropsList?.length || 0}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase' }}>
                Crops
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Crop Plots in Selected Farm */}
      {!loading && activeFarm && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ag-color-text-primary)', margin: 0 }}>
              {t.plotsHeading}
            </h3>
            <span style={{ fontSize: '13px', color: 'var(--ag-color-text-secondary)' }}>
              {activeFarm.plots.length} {activeFarm.plots.length === 1 ? 'plot' : 'plots'} recorded
            </span>
          </div>

          {activeFarm.plots.length === 0 ? (
            <div style={{
              backgroundColor: 'var(--ag-color-surface-base)',
              borderRadius: '16px',
              border: '1px dashed var(--ag-border-default)',
              padding: '36px 20px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ag-color-text-primary)', margin: '0 0 4px 0' }}>
                {t.noCropsMonitored || 'No crops are being monitored yet.'}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--ag-color-text-secondary)', margin: '0 0 16px 0' }}>
                Plan your crop to start recording health observations, spray schedules, and recommendations.
              </p>
              <button
                onClick={() => setShowPlanWizard(true)}
                style={{
                  backgroundColor: 'var(--ag-color-primary-base)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 'var(--ag-radius-full)',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {t.planCropBtn || 'Plan a Crop'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activeFarm.plots.map((plot) => {
                const badge = getStatusBadge(plot.status);
                return (
                  <div
                    key={plot.id}
                    style={{
                      backgroundColor: 'var(--ag-color-surface-base)',
                      borderRadius: '16px',
                      border: '1px solid var(--ag-border-default)',
                      padding: '20px',
                      boxShadow: 'var(--ag-shadow-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    {/* Plot Card Top Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ag-color-text-primary)', margin: 0 }}>
                            {plot.currentCrop}
                          </h4>
                          <span style={{
                            backgroundColor: '#FAFBF7',
                            color: 'var(--ag-color-text-secondary)',
                            fontSize: '12px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--ag-radius-full)',
                            border: '1px solid var(--ag-border-default)',
                          }}>
                            {plot.acres} Acres
                          </span>
                          {plot.variety && (
                            <span style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)' }}>
                              ({plot.variety})
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--ag-color-text-secondary)', marginTop: '4px' }}>
                          <span>🌱 {plot.stage}</span>
                          {plot.daysSincePlanting !== undefined && plot.daysSincePlanting > 0 && (
                            <>
                              <span>·</span>
                              <span>📅 Day {plot.daysSincePlanting} since planting</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Health Status Badge */}
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: badge.border,
                        padding: '4px 12px',
                        borderRadius: 'var(--ag-radius-full)',
                        fontSize: '12px',
                        fontWeight: 800,
                      }}>
                        {badge.icon}
                        <span>{badge.label}</span>
                      </div>
                    </div>

                    {/* Day-to-Day Actions Row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '12px',
                      backgroundColor: '#FAFBF7',
                      padding: '14px',
                      borderRadius: '12px',
                      border: '1px solid var(--ag-border-default)',
                    }}>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ag-color-primary-base)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          ⚡ {t.todayCropAction}
                        </span>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontWeight: 700, color: 'var(--ag-color-text-primary)' }}>
                          {plot.todayAction || 'No immediate action pending.'}
                        </p>
                      </div>

                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          🗓 {t.nextCropAction}
                        </span>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontWeight: 600, color: 'var(--ag-color-text-secondary)' }}>
                          {plot.nextAction || 'Maintain routine monitoring.'}
                        </p>
                      </div>
                    </div>

                    {/* Plot Actions Footer */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button
                        onClick={onNavigateToCropDoctor}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: 'transparent',
                          color: 'var(--ag-color-primary-base)',
                          border: '1px solid var(--ag-color-primary-base)',
                          padding: '8px 14px',
                          borderRadius: 'var(--ag-radius-full)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          minHeight: '36px',
                        }}
                      >
                        <Stethoscope size={14} />
                        <span>Diagnose {plot.currentCrop}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Plan Crop Guided Modal */}
      {showPlanWizard && (
        <PlanCropWizard
          isOpen={showPlanWizard}
          onClose={() => setShowPlanWizard(false)}
          farms={farms}
          location={location}
          currentLang={currentLang}
          onCropStarted={loadFarms}
        />
      )}
    </div>
  );
};
