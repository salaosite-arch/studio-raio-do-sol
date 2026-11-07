/**
 * Módulo de Backup Automático e Espelhamento em Tempo Real (Supabase)
 * Studio Raio do Sol
 * 
 * Nota: Se o banco principal (DATABASE_URL) já for o próprio Supabase,
 * o espelhamento redundante é desativado automaticamente para evitar
 * gravações duplicadas e lentidão no banco de dados.
 */

const { Pool } = require('pg');

const SUPABASE_URI = process.env.BACKUP_DATABASE_URL || 
    'postgresql://postgres.vvktnslnvqgeznuzmroz:StudioRaio2026%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

const mainUri = process.env.DATABASE_URL || '';
const isMainAlreadySupabase = mainUri.includes('vvktnslnvqgeznuzmroz') || mainUri === SUPABASE_URI;

let backupPool = null;

if (!isMainAlreadySupabase) {
    try {
        backupPool = new Pool({
            connectionString: SUPABASE_URI,
            ssl: { rejectUnauthorized: false }
        });
        console.log('🛡️ [Backup Automático] Módulo de espelhamento secundário (Supabase) ativo.');
    } catch (e) {
        console.warn('⚠️ [Backup Automático] Não foi possível inicializar pool de backup:', e.message);
    }
} else {
    console.log('✅ [Banco Principal] Conectado diretamente ao Supabase (espelhamento redundante desativado para máxima velocidade).');
}

async function mirrorCreateAppointment(a) {
    if (!backupPool || !a) return;
    try {
        await backupPool.query(`
            INSERT INTO appointments (
                id, professional_id, professional_name, professional_initials, professional_color,
                client, phone, service_id, service_name, service_price,
                date, time_start, time_end, status, payout_invoiced, created_by,
                is_mutual, professional2_id, professional2_name, professional2_initials, professional2_color
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
            ON CONFLICT (id) DO UPDATE SET
                client=EXCLUDED.client, phone=EXCLUDED.phone, service_name=EXCLUDED.service_name,
                service_price=EXCLUDED.service_price, date=EXCLUDED.date, time_start=EXCLUDED.time_start,
                time_end=EXCLUDED.time_end, status=EXCLUDED.status, professional_name=EXCLUDED.professional_name
        `, [
            String(a.id),
            (a.professionalId && String(a.professionalId).trim() !== '') ? String(a.professionalId) : null,
            a.professionalName || '',
            a.professionalInitials || '',
            a.professionalColor || '',
            a.client || '',
            a.phone || '',
            (a.serviceId && String(a.serviceId).trim() !== '') ? String(a.serviceId) : null,
            a.serviceName || '',
            parseFloat(a.servicePrice) || 0,
            a.date, a.timeStart, a.timeEnd,
            a.status || 'Agendado',
            a.payoutInvoiced || false,
            a.createdBy || '',
            a.isMutual || false,
            (a.professionalId2 && String(a.professionalId2).trim() !== '') ? String(a.professionalId2) : null,
            a.professionalName2 || '',
            a.professionalInitials2 || '',
            a.professionalColor2 || ''
        ]);
    } catch (err) {
        console.warn('⚠️ [Backup Mirror] Aviso ao espelhar agendamento:', err.message);
    }
}

async function mirrorDeleteAppointment(apptId) {
    if (!backupPool || !apptId) return;
    try {
        await backupPool.query('DELETE FROM appointments WHERE id = $1', [String(apptId)]);
    } catch (err) {
        console.warn('⚠️ [Backup Mirror] Aviso ao espelhar exclusão:', err.message);
    }
}

async function startDailyBackupRoutine(mainDb) {
    if (!backupPool || !mainDb) return;
}

module.exports = {
    mirrorCreateAppointment,
    mirrorDeleteAppointment,
    startDailyBackupRoutine
};
