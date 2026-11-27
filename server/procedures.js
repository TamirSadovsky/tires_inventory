export const procedureContract = {
  provider: "pending",
  note: "השמירה כרגע מקומית. כשיסופקו הפרוצדורות, מממשים כאן את אותם שמות ומעבירים את DB_PROVIDER ל-procedures.",
  procedures: [
    {
      name: "usp_FindUserByUsername",
      inputs: ["Username"],
      returns: ["Id", "Username", "PasswordHash", "DisplayName"],
    },
    {
      name: "usp_CreateUser",
      inputs: ["Username", "PasswordHash", "DisplayName"],
    },
    {
      name: "usp_SaveTire",
      inputs: [
        "EprelRegistrationNumber",
        "SourceUrl",
        "Brand",
        "CommercialName",
        "ModelIdentifier",
        "Gtin",
        "TyreClass",
        "SizeDesignation",
        "TyreDesignation",
        "SectionWidth",
        "AspectRatio",
        "RimDiameter",
        "LoadIndex",
        "LoadKg",
        "SpeedSymbol",
        "SpeedKmh",
        "LoadVersion",
        "FuelClass",
        "WetGripClass",
        "NoiseDb",
        "NoiseClass",
        "SnowTyre",
        "IceTyre",
        "ProductionWeek",
        "ProductionYear",
        "OrganisationName",
        "Website",
        "Status",
        "SummaryHe",
        "RawJson",
        "ScannedBy",
      ],
    },
    {
      name: "usp_ListTires",
      inputs: [],
    },
    {
      name: "usp_GetTire",
      inputs: ["Id"],
    },
    {
      name: "usp_ListTiresBySize",
      inputs: ["SizeDesignation", "ExceptEprelRegistrationNumber"],
    },
    {
      name: "usp_InsertScan",
      inputs: ["RawCode", "CodeType", "ResolvedUrl", "EprelNumber", "TireId", "UserId", "Status", "Message"],
    },
  ],
}

export function createProcedureStore() {
  const pending = (name) => () => {
    throw new Error(`הפרוצדורה ${name} עדיין לא חוברה`)
  }
  return {
    provider: "procedures",
    countUsers: pending("usp_CountUsers"),
    findUser: pending("usp_FindUserByUsername"),
    createUser: pending("usp_CreateUser"),
    saveTire: pending("usp_SaveTire"),
    listTires: pending("usp_ListTires"),
    getTire: pending("usp_GetTire"),
    listBySize: pending("usp_ListTiresBySize"),
    insertScan: pending("usp_InsertScan"),
  }
}
