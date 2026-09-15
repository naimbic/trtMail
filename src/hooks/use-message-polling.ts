import { useEffect, useState, useCallback } from "react";
import type { MessageRealtimeState, NewMessageEvent } from "./message-realtime-types";
export function useMessagePolling():MessageRealtimeState {
 const [notification]=useState<NewMessageEvent|null>(null);
 const dismissNotification=useCallback(()=>{},[]);
 useEffect(()=>{const refresh=()=>{if(!document.hidden)window.dispatchEvent(new Event("trtmail:messages-changed"));};const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 return {notification,dismissNotification};
}
