import { forwardRef } from 'react'
import { DocumentPreview } from './DocumentPreview'

interface BonLivraisonClientDocumentProps {
  bon: any;
  entreprise: any;
  /** BCP-47 language tag from i18n.language */
  lang?: string;
}

export const BonLivraisonClientDocument = forwardRef<HTMLDivElement, BonLivraisonClientDocumentProps>(
  ({ bon, entreprise, lang }, ref) => {
    if (!bon) return null
    return (
      <DocumentPreview
        ref={ref}
        type="bon_livraison_client"
        data={bon}
        entreprise={entreprise}
        lang={lang}
      />
    )
  }
)

BonLivraisonClientDocument.displayName = 'BonLivraisonClientDocument'
