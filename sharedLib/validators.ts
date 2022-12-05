import {CodeManifest} from "./types"
import {
    NULL_FIELD, UUID_LENGTH,
    ALL_CRATE_VERSIONS,
    LATEST_CRATE_VERSION,
    reservedIds
} from "./consts"

type CManifest = Required<CodeManifest> & {
    authors: {name: string, email: string, url: string}[]
}

const orNull = <T extends string>(str?: T) => str || NULL_FIELD

const typevalid = <T extends Record<string, unknown>>(
    obj: T,
    key: keyof T,
    type: "string" | "object",
    errs: string[]
) => {
    const t = typeof obj[key]
    if (t === type) {
        return true
    }
    errs.push(`${key as string} should be a ${type}, got "${t}"`)
    return false
}

const validVersion = (version: string) => {
    if (version.length < 1) {
        return false
    }
    const s = version.split("-")[0].split(".")
    if (s.length !== 3) {
        return false
    }
    for (let i = 0; i < s.length; i++) {
        const vs = s[i]
        if (typeof vs === "symbol" || Number.isNaN(parseInt(vs, 10))) {
            return false
        }
    }
    return true
}

export const validateManifest = (
    cargo: unknown, 
    disallowStdPkgs: boolean
) => {
    const errors: string[] = []
    const pkg: CManifest = {
        uuid: "",
        crateVersion: "0.1.0",
        name: "",
        version: "",
        entry: "",
        files: [],

        // optional fields
        description: NULL_FIELD,
        authors: [],
        crateLogoUrl: NULL_FIELD,
        keywords: [],
        license: NULL_FIELD,
        repo: {type: NULL_FIELD, url: NULL_FIELD},
        homepageUrl: NULL_FIELD
    }
    const out = {pkg, errors}
    const c = cargo as CodeManifest
    if (typeof c !== "object") {
        errors.push(`expected manifest to be type "object" got "${typeof c}"`)
        return out
    } else if (Array.isArray(c)) {
        errors.push(`expected manifest to be type "object" got "array"`)
        return out
    }

    if (!typevalid(c, "uuid", "string", errors)) {

    } else if (c.uuid.length < UUID_LENGTH) {
        errors.push(`uuid should be ${UUID_LENGTH} characters got ${c.uuid.length} characters`)
    } else if (
        // check if package uuid clashes with any of the
        // reserved ids
        disallowStdPkgs && Object.values(reservedIds).includes(c.uuid as typeof reservedIds[keyof typeof reservedIds])
    ) {
        errors.push(`uuid can not be one of reserved ids: ${Object.values(reservedIds).join()}`)
    } else if (
        // check if uuid is url-safe
        encodeURIComponent(decodeURIComponent(c.uuid)) !== c.uuid
    ) {
        errors.push("uuid should only contain url safe characters")
    }
    pkg.uuid = c.uuid || NULL_FIELD

    if (!ALL_CRATE_VERSIONS[c.crateVersion]) {
        errors.push(`crate version is invalid, got "${c.crateVersion}", valid=${Object.keys(ALL_CRATE_VERSIONS).join()}`)
    }
    pkg.crateVersion = c.crateVersion || LATEST_CRATE_VERSION

    if (!typevalid(c, "name", "string", errors)) {

    } else if (
        // check if package name clashes with any of the
        // reserved names
        disallowStdPkgs && Object.keys(reservedIds).includes(c.name)
    ) {
        errors.push(`name cannot be reserved names: ${Object.keys(reservedIds).join()}`)
    }
    pkg.name = orNull(c.name)

    if (!typevalid(c, "version", "string", errors)) {

    } else if (!validVersion(c.version)) {
        errors.push(`${c.version} is not a vaild version`)
    }
    pkg.version = orNull(c.version)

    if (typevalid(c, "entry", "string", errors)) {}
    pkg.entry = c.entry || ""

    const fIsArray = Array.isArray(c.files)
    if (!fIsArray) {
        errors.push(`files should be an array, got "${typeof c.files}"`)
    }
    let validFiles = true
    const f = !fIsArray ? [] : c.files
    for (let i = 0; i < f.length; i++) {
        const fi = f[i]
        if (typeof fi?.name !== "string" || typeof fi?.bytes !== "number") {
            errors.push(`file ${i} is not a valid file format`)
            break
        }
    }
    if (validFiles) {
        pkg.files = c.files
    }

    pkg.description = orNull(c.description)
    pkg.authors = (c.authors || [])
        .filter(a => typeof a?.name === "string")
        .map(({name, email, url}) => ({
            name,  email: orNull(email), url: orNull(url)
        }))
    pkg.crateLogoUrl = orNull(c.crateLogoUrl)
    pkg.keywords = (c.keywords || []).filter(w => typeof w === "string")
    pkg.license = orNull(c.license)
    pkg.repo.type = orNull(c.repo?.type)
    pkg.repo.url = orNull(c.repo?.url)
    pkg.homepageUrl = orNull(c.homepageUrl)
    return out
}