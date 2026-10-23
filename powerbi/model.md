# Reference semantic model authoring specification

Run `npm run powerbi:export -- WORKSPACE` and import that organization's files only. Names are case-sensitive for the application filter contract.

| Dimension (unique key) | Fact foreign key        | Relationship                  |
| ---------------------- | ----------------------- | ----------------------------- |
| Date[Date]             | Each Fact_*[Date]       | One-to-many, single direction |
| Customer[CustomerId]   | Each Fact_*[CustomerId] | One-to-many, single direction |
| Plan[Name]             | Each Fact_*[PlanName]   | One-to-many, single direction |
| Region[Name]           | Each Fact_*[RegionName] | One-to-many, single direction |

Fact_invoice grain: one customer invoice record per issue date. Amount is net of credits, excluding tax. Fact_subscription grain: customer month-end snapshot, MRR includes zero for observed churned subscriptions. Fact_usage grain: customer/day usage partition. Fact_infrastructure grain: customer/month attribution, plus the explicit Unallocated customer/segment.

Do not join fact tables directly or use bidirectional filters to bridge their grains. Format money as USD and ratios as percentages. Date is a contiguous daily calendar; Month sorts chronologically. Disable automatic local date tables.

Add disconnected RegionAccess[UserName, RegionName] with approved identity mappings. RegionScope RLS on Region:

```dax
VAR AllowedRegions =
    SELECTCOLUMNS(
        FILTER(RegionAccess, RegionAccess[UserName] = USERPRINCIPALNAME()),
        "Allowed", RegionAccess[RegionName]
    )
RETURN Region[Name] IN AllowedRegions
```

Hide RegionAccess from report authors who do not administer the model. Test effective usernames through a real embed token. Only add 'Unallocated' to identities entitled to see global attribution costs.

Use measures.dax as the explicit starting catalog. The retention measures use the first and last observed snapshots in the selected Date interval, matching the reference application's disclosed period semantics. A single-month slice therefore has no independent pre-period opening snapshot. For a production opening-balance definition, create a new version and update both engines and benchmark expectations.

Source artifacts and DAX are reviewable authoring inputs. They are not presented as a Microsoft-validated PBIX/PBIP package.
