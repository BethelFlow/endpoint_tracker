import moment from 'moment';

export interface Stats {
  dailyCalls: { date: string; count: number };
  weeklyCalls: { week: number; count: number };
  blocks: BlockEvent[];
}

interface BlockEvent {
  endpoint: string;
  timestamp: string;
  status: number | null;
  reason: string;
}

interface CallTracker {
  daily: { date: string; count: number };
  weekly: { week: number; count: number };
  blocks: BlockEvent[];
}

let callTracker: CallTracker = {
  daily: { date: moment().format('YYYY-MM-DD'), count: 0 },
  weekly: { week: moment().week(), count: 0 },
  blocks: [],
};

export function resetCountersIfNeeded(){
  const today: string = moment().format('YYYY-MM-DD');
  const currentWeek: number = moment().week();

  if (callTracker.daily.date !== today) {
    callTracker.daily = { date: today, count: 0 };
  }
  if (callTracker.weekly.week !== currentWeek) {
    callTracker.weekly = { week: currentWeek, count: 0 };
  }
}

export function incrementCallCount() {
  callTracker.daily.count++;
  callTracker.weekly.count++;
}

export function recordBlock(blockEvent: BlockEvent) {
  callTracker.blocks.push(blockEvent);
}

export function getStats(): Stats {
  return {
    dailyCalls: callTracker.daily,
    weeklyCalls: callTracker.weekly,
    blocks: callTracker.blocks,
  };
}