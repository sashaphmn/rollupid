import React from 'react'

const svgString = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 2V11.4475H11.4475V2H2Z" fill="#F25022"/>
<path d="M12.5525 2V11.4475H22V2H12.5525Z" fill="#7FBA00"/>
<path d="M2 12.5525V22H11.4475V12.5525H2Z" fill="#00A4EF"/>
<path d="M12.5525 12.5525V22H22V12.5525H12.5525Z" fill="#FFB900"/>
</svg>`

export const WrappedSVG = (
    <div
        className="dark:text-white"
        dangerouslySetInnerHTML={{
            __html: svgString,
        }}
    ></div>
)

export default `data:image/svg+xml;base64,${btoa(svgString)}`



