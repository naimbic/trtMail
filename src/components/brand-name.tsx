export function BrandName({ name = "trtDigital Mail" }: { name?: string }) {
 return ["trtMail", "trtDigital Mail"].includes(name) ? <span className="mail-wordmark" aria-label="trtDigital Mail"><span>trt<strong>Digital</strong></span><span className="mail-wordmark-product">Mail</span></span> : <>{name}</>;
}
