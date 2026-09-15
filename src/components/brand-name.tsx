export function BrandName({name='trtMail'}:{name?:string}) {
 return name==='trtMail' ? <span aria-label="trtMail"><span className="font-normal text-slate-900">trt</span><span className="font-bold text-blue-600">Mail</span></span> : <>{name}</>;
}
